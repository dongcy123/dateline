import type { Objective } from '@/types/event';
import type { AIProxyResponse } from '@/types/ai';
import { OBJ_PALETTE } from './constants';

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

时间提取: 绝对时间(下午五点→17:00)、相对时间(昨晚八点→昨天20:00)、日期+时间(下周三下午3点→推算日期)。无法提取则 timeline_time 为 null。

只返回 JSON。`;

// AI 代理 — 同源 /api/proxy（server.js / Render）
export const callAI = async (
  text: string,
  _objectives: Objective[]
): Promise<{ result: AIProxyResponse; aiPending: Promise<unknown> | null }> => {
  const proxyUrl = '/api/proxy';

  const doFetch = (): Promise<AIProxyResponse> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      console.warn('[callAI] timeout after 18s');
      controller.abort();
    }, 18000);

    const p = fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, engine: 'text' }),
      signal: controller.signal,
      cache: 'no-store',
    }).then(async r => {
      clearTimeout(timeout);
      if (r.ok) return (await r.json()) as AIProxyResponse;
      const err = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(err?.error?.message || 'AI proxy ' + r.status);
    }).catch(e => {
      clearTimeout(timeout);
      throw e;
    });

    return p;
  };

  // Race: AI response vs 3s fallback timer
  const aiPromise = doFetch();
  const winner = await Promise.race([
    aiPromise.then(r => ({ source: 'ai' as const, data: r })),
    new Promise<{ source: 'fallback'; data: null }>(resolve =>
      setTimeout(() => resolve({ source: 'fallback', data: null }), 3000)
    ),
  ]);

  if (winner.source === 'fallback') {
    console.log('[callAI] 3s fallback → localParse, AI still pending');
    return {
      result: localParse(text),
      aiPending: aiPromise.catch(e => {
        console.warn('[callAI] late AI also failed:', e instanceof Error ? e.message : String(e));
        return null;
      }),
    };
  }

  console.log('[callAI] AI responded in <3s');
  return { result: winner.data, aiPending: null };
};

// 中文时间解析 (AI 失败兜底)
export const parseTime = (text: string, ref: Date = new Date()): Date => {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);

  if (/大后天/.test(text)) d.setDate(d.getDate() + 3);
  else if (/后天/.test(text)) d.setDate(d.getDate() + 2);
  else if (/明天/.test(text)) d.setDate(d.getDate() + 1);

  const wm: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
  const nw = text.match(/下周([一二三四五六日天])/);
  if (nw) {
    const t = wm[nw[1]];
    const c = d.getDay();
    const du = (t - c + 7) % 7 || 7;
    d.setDate(d.getDate() + du);
  }

  const dm = text.match(/(\d{1,2})月(\d{1,2})[日号]?/);
  if (dm) {
    d.setMonth(parseInt(dm[1]) - 1);
    d.setDate(parseInt(dm[2]));
  }

  let h = ref.getHours();
  let m = ref.getMinutes();
  const tm = text.match(/(\d{1,2})[点:：](\d{1,2})?/);
  if (tm) {
    h = parseInt(tm[1]);
    m = tm[2] ? parseInt(tm[2]) : 0;
    if (/(下午|晚上)/.test(text) && h < 12) h += 12;
  }
  if (/半/.test(text) && m === 0) m = 30;

  d.setHours(h, m, 0, 0);
  return d;
};

// 本地规则 (AI 不可用时)
export const localParse = (text: string): AIProxyResponse => {
  if (/^(目标|标签)[：:]\s*(.+)/.test(text)) {
    const m = text.match(/^(目标|标签)[：:]\s*(.+)/)!;
    return {
      type: 'objective',
      objective_id: null,
      ai_metadata: {
        title: m[2].trim(),
        color: OBJ_PALETTE[Math.floor(Math.random() * OBJ_PALETTE.length)],
      },
    };
  }
  const isTodo = /要|去|记得|做|完成|写|整理|准备|列出|标注/.test(text) &&
    !/完成了|做了|读了|跑了/.test(text);
  return {
    type: isTodo ? 'todo' : 'note',
    objective_id: null,
    ai_metadata: {
      task_title: text.replace(/[的了是就也会要能都去把被让到着在]/g, '').trim().substring(0, 12) || text.substring(0, 12),
      progress_delta: isTodo ? 0 : 1,
    },
    timeline_time: undefined,
  };
};

// 关键词→目标匹配
export const matchObj = (text: string, objs: Objective[]): string | null => {
  for (const o of objs) {
    for (const kw of o.title.split(/[\s\-—]+/)) {
      if (kw.length >= 2 && text.includes(kw)) return o.id;
    }
  }
  return null;
};

export { SYSTEM_PROMPT };
