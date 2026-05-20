// TimelineOS — AI Dual-Engine Proxy
// Supabase Edge Function (Deno)
// 文本 → DeepSeek | 图像 → Vision Model | 统一 JSON 输出

import { corsHeaders } from '../_shared/cors.ts';

interface AIProxyRequest {
  text?: string;
  image_url?: string;
  engine?: 'auto' | 'text' | 'vision';
}

interface AIProxyResponse {
  type: 'expense' | 'todo' | 'note';
  ai_metadata: Record<string, unknown>;
  confidence?: number;
  raw_text?: string;
}

interface AIProxyError {
  error: {
    type: string;
    code: string;
    message: string;
    param?: string;
    doc_url?: string;
  };
}

const SYSTEM_PROMPT = `你是一个个人管理助手。分析用户输入并返回严格的 JSON。

规则：
1. 如果涉及金额、消费、购物 → type: "expense"，ai_metadata: {"amount": 数字, "tag": "餐饮|购物|交通|娱乐|教育|其他"}
2. 如果是任务、待办、提醒 → type: "todo"，ai_metadata: {"task": "任务名", "priority": "high|normal|low"}
3. 其他记录、想法、笔记 → type: "note"，ai_metadata: {"summary": "摘要"}

只返回 JSON，不要任何额外文字。`;

function parseAIResponse(content: string): AIProxyResponse {
  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(content);
    return validateResponse(parsed);
  } catch {
    // Vision models may wrap JSON in markdown
    const cleaned = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    return validateResponse(parsed);
  }
}

function validateResponse(raw: Record<string, unknown>): AIProxyResponse {
  const type = raw.type as string;
  if (!['expense', 'todo', 'note'].includes(type)) {
    throw new Error(`Invalid type: ${type}`);
  }
  return {
    type: type as AIProxyResponse['type'],
    ai_metadata: (raw.ai_metadata as Record<string, unknown>) || {},
    confidence: raw.confidence as number | undefined,
    raw_text: raw.raw_text as string | undefined,
  };
}

async function callDeepSeek(text: string): Promise<AIProxyResponse> {
  const key = Deno.env.get('DEEPSEEK_API_KEY');
  if (!key) throw { code: 'config_error', message: 'DEEPSEEK_API_KEY not set' };

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `分析以下中文输入，判断类型并提取结构化数据：\n\n"${text}"` },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) throw { code: 'api_key_invalid', message: 'DeepSeek API 密钥无效' };
    if (res.status === 429) throw { code: 'rate_limit', message: '请求过于频繁' };
    throw { code: 'api_error', message: `DeepSeek (${res.status}): ${body.slice(0, 200)}` };
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw { code: 'parse_error', message: 'DeepSeek 返回为空' };

  return parseAIResponse(content);
}

async function callVision(imageUrl: string): Promise<AIProxyResponse> {
  const key = Deno.env.get('VISION_API_KEY');
  if (!key) throw { code: 'config_error', message: 'VISION_API_KEY not set' };

  const baseUrl = Deno.env.get('VISION_BASE_URL') || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const model = Deno.env.get('VISION_MODEL') || 'qwen-vl-max';

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: '请识别这张图片并提取结构化信息。如果是收据/小票，提取金额和分类。如果是海报/文档，提取关键信息。' },
          ],
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) throw { code: 'api_key_invalid', message: '视觉模型 API 密钥无效' };
    if (res.status === 429) throw { code: 'rate_limit', message: '请求过于频繁' };
    throw { code: 'api_error', message: `Vision (${res.status}): ${body.slice(0, 200)}` };
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw { code: 'parse_error', message: '视觉 AI 返回为空' };

  return parseAIResponse(content);
}

function errorResponse(err: { code: string; message: string }, status: number): Response {
  const body: AIProxyError = {
    error: {
      type: err.code.startsWith('api_') ? 'api_error' : err.code === 'rate_limit' ? 'rate_limit' : 'parse_error',
      code: err.code,
      message: err.message,
      doc_url: 'https://github.com/timeline-os/errors',
    },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ==========================================
// Main handler
// ==========================================
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const debug = Deno.env.get('AI_PROXY_DEBUG') === 'true';

  try {
    const body: AIProxyRequest = await req.json();
    const engine = body.engine || (body.image_url ? 'vision' : 'text');

    if (debug) {
      console.log('[ai-proxy] engine:', engine, 'text:', body.text?.slice(0, 50), 'image:', !!body.image_url);
    }

    let result: AIProxyResponse;

    if (engine === 'vision' && body.image_url) {
      result = await callVision(body.image_url);
    } else if (body.text) {
      result = await callDeepSeek(body.text);
    } else {
      return errorResponse(
        { code: 'invalid_request', message: '必须提供 text 或 image_url' },
        400,
      );
    }

    if (debug) {
      console.log('[ai-proxy] result:', JSON.stringify(result));
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    const code = e.code || 'unknown';
    const message = e.message || '未知错误';

    console.error('[ai-proxy] error:', code, message);

    // Map error codes to HTTP status
    const statusMap: Record<string, number> = {
      config_error: 500,
      api_key_invalid: 401,
      rate_limit: 429,
      parse_error: 422,
      api_error: 502,
      invalid_request: 400,
    };

    return errorResponse(
      { code, message },
      statusMap[code] || 500,
    );
  }
});
