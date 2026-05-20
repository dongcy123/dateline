import type { AIProxyRequest, AIProxyResponse, AIProxyError } from '@/types/ai';
import type { TimelineEvent } from '@/types/event';
import { toAPIError } from '@/lib/errors';

const AI_PROXY_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-proxy`
  : '';

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const VISION_KEY = process.env.VISION_API_KEY;
const DEBUG = process.env.AI_PROXY_DEBUG === 'true';

function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

/**
 * Dual-engine AI proxy.
 * Text → DeepSeek API. Image → Vision model API.
 * Both return standardized AIProxyResponse.
 */
export async function processWithAI(request: AIProxyRequest): Promise<TimelineEvent> {
  const engine = request.engine || (request.image_url ? 'vision' : 'text');

  try {
    let response: AIProxyResponse;

    if (AI_PROXY_URL && AI_PROXY_URL.includes('supabase')) {
      // Production: call Supabase Edge Function
      response = await callEdgeFunction(request);
    } else if (engine === 'vision') {
      response = await callVisionAPI(request.image_url!);
    } else {
      response = await callDeepSeekAPI(request.text || '');
    }

    if (DEBUG) {
      console.log('[AI Proxy] Engine:', engine, 'Response:', JSON.stringify(response, null, 2));
    }

    return {
      id: generateId(),
      timeline_time: new Date().toISOString(),
      record_time: new Date().toISOString(),
      raw_content: request.text || (request.image_url ? '[图片凭证]' : ''),
      type: response.type,
      status: 'pending',
      ai_metadata: response.ai_metadata,
    };
  } catch (err) {
    const apiError = toAPIError(err);
    if (DEBUG) {
      console.error('[AI Proxy] Error:', apiError);
    }
    throw apiError;
  }
}

async function callEdgeFunction(request: AIProxyRequest): Promise<AIProxyResponse> {
  const res = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const err: AIProxyError = await res.json();
    throw new Error(JSON.stringify(err.error));
  }

  return res.json();
}

async function callDeepSeekAPI(text: string): Promise<AIProxyResponse> {
  if (!DEEPSEEK_KEY) throw new Error('DEEPSEEK_API_KEY not configured');

  const prompt = buildDeepSeekPrompt(text);
  const res = await fetch(`${process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`DeepSeek API: ${res.status} ${await res.text()}`);

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content) as AIProxyResponse;
}

async function callVisionAPI(imageUrl: string): Promise<AIProxyResponse> {
  if (!VISION_KEY) throw new Error('VISION_API_KEY not configured');

  const res = await fetch(`${process.env.VISION_BASE_URL || ''}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VISION_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.VISION_MODEL || 'qwen-vl-max',
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

  if (!res.ok) throw new Error(`Vision API: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const content = data.choices[0].message.content;
  // Vision models may return markdown-wrapped JSON
  const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr) as AIProxyResponse;
}

export function buildDeepSeekPrompt(text: string): string {
  return `分析以下中文输入，判断类型并提取结构化数据：\n\n"${text}"\n\n返回 JSON: {"type":"expense|todo|note","ai_metadata":{...}}`;
}

const SYSTEM_PROMPT = `你是一个个人管理助手。分析用户输入并返回严格的 JSON。

规则：
1. 如果涉及金额、消费、购物 → type: "expense"，ai_metadata: {"amount": 数字, "tag": "餐饮|购物|交通|娱乐|教育|其他"}
2. 如果是任务、待办、提醒 → type: "todo"，ai_metadata: {"task": "任务名", "priority": "high|normal|low"}
3. 其他记录、想法、笔记 → type: "note"，ai_metadata: {"summary": "摘要"}

只返回 JSON，不要任何额外文字。`;
