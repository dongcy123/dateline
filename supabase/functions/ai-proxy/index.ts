// 川上 AI 代理 — Supabase Edge Function (Deno)
// 文本 → DeepSeek | 图像 → Qwen-VL | 统一 JSON 输出

import { corsHeaders } from '../_shared/cors.ts';

interface AIProxyRequest {
  text?: string;
  image_url?: string;
  engine?: 'auto' | 'text' | 'vision';
}

interface AIProxyResponse {
  type: 'todo' | 'note' | 'objective';
  objective_id: string | null;
  ai_metadata: Record<string, unknown>;
  timeline_time?: string | null;
  confidence?: number;
}

const SYSTEM_PROMPT = `你是《川上》个人战略执行系统的 AI 助手。分析用户输入，返回严格 JSON。

类型判断:
- todo: 待执行的行动、任务、计划
- note: 记录、想法、观察、已完成的事
- 创建目标时 type="objective"，ai_metadata={"title":"目标名","color":"#hex"}

输出格式:
{"type":"todo|note|objective","objective_id":null,"ai_metadata":{"task_title":"精炼短标题","progress_delta":数字},"timeline_time":"ISO 8601 或 null"}

task_title 规则（最重要）:
- 将用户输入精炼为去口语化、动作导向的标题，12 字以内
- 绝不复制原文，必须提炼重组
- 示例: "六月一号前完成数据标注训练模型" → "数据标注与模型训练"
- 示例: "今天八点开始学习资料分析" → "资料分析速成学习"
- 示例: "增加像素画logo设计" → "设计像素画Logo"

progress_delta: 已完成且有数量→提取数字(如"标注10张"→10); 待做→0; 无数字→1

时间提取:
- 绝对时间: "下午五点"→17:00, "上午九点"→09:00
- 相对时间: "昨晚八点"→昨天20:00, "明天上午十点"→明天10:00
- 日期+时间: "下周三下午3点"→推算日期, ISO 8601格式
- 无法提取则 timeline_time 为 null

只返回 JSON，不要任何额外文字。`;

function parseAIResponse(content: string): AIProxyResponse {
  try {
    const parsed = JSON.parse(content);
    return validateResponse(parsed);
  } catch {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return validateResponse(parsed);
  }
}

function validateResponse(raw: Record<string, unknown>): AIProxyResponse {
  const type = raw.type as string;
  if (!['todo', 'note', 'objective'].includes(type)) {
    throw new Error(`Invalid type: ${type}`);
  }
  return {
    type: type as AIProxyResponse['type'],
    objective_id: (raw.objective_id as string) || null,
    ai_metadata: (raw.ai_metadata as Record<string, unknown>) || {},
    timeline_time: raw.timeline_time as string | null,
    confidence: raw.confidence as number | undefined,
  };
}

async function callDeepSeek(text: string): Promise<AIProxyResponse> {
  const key = Deno.env.get('DEEPSEEK_API_KEY');
  if (!key) throw { code: 'config_error', message: 'DEEPSEEK_API_KEY not set' };

  const now = new Date();
  const nowStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00+08:00`;

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `当前时间：${nowStr}\n\n分析以下中文输入：\n\n"${text}"` },
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
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
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

function errorJSON(err: { code: string; message: string }, status: number): Response {
  return new Response(JSON.stringify({
    error: {
      type: err.code.startsWith('api_') ? 'api_error' : err.code === 'rate_limit' ? 'rate_limit' : 'parse_error',
      code: err.code,
      message: err.message,
    },
  }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: AIProxyRequest = await req.json();
    const engine = body.engine || (body.image_url ? 'vision' : 'text');

    let result: AIProxyResponse;
    if (engine === 'vision' && body.image_url) {
      result = await callVision(body.image_url);
    } else if (body.text) {
      result = await callDeepSeek(body.text);
    } else {
      return errorJSON({ code: 'invalid_request', message: '必须提供 text 或 image_url' }, 400);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    const code = e.code || 'unknown';
    const message = e.message || '未知错误';
    console.error('[ai-proxy]', code, message);

    const statusMap: Record<string, number> = {
      config_error: 500, api_key_invalid: 401, rate_limit: 429,
      parse_error: 422, api_error: 502, invalid_request: 400,
    };
    return errorJSON({ code, message }, statusMap[code] || 500);
  }
});
