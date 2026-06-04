// ==========================================
// AI 引擎 — 代理调用 + 时间解析 + 本地兜底
// ==========================================
window.Kawa = window.Kawa || {};

const callAI = async (text, objectives) => {
  const isFileProto = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const proxyUrl = isFileProto ? 'http://localhost:8765' : '/api/proxy';

  const doFetch = async (attempt) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => { console.warn('[callAI] attempt ' + attempt + ' timeout after 12s'); controller.abort(); }, 12000);
    try {
      const r = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, engine: 'text' }),
        signal: controller.signal,
        cache: 'no-store',
      });
      if (r.ok) return await r.json();
      const err = await r.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'AI proxy ' + r.status);
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    return await doFetch(1);
  } catch (e) {
    console.warn('[callAI] attempt 1 failed:', e.message);
    // Retry once on network failure — often succeeds on fresh connection
    try { return await doFetch(2); } catch (e2) {
      console.warn('[callAI] attempt 2 also failed:', e2.message);
      throw e2;
    }
  }
};

window.Kawa.callAI = callAI;

// 中文时间解析 (AI 失败兜底)
window.Kawa.parseTime = (text, ref = new Date()) => {
  const d = new Date(ref); d.setHours(0, 0, 0, 0);
  if (/大后天/.test(text)) d.setDate(d.getDate() + 3);
  else if (/后天/.test(text)) d.setDate(d.getDate() + 2);
  else if (/明天/.test(text)) d.setDate(d.getDate() + 1);
  const wm = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
  const nw = text.match(/下周([一二三四五六日天])/);
  if (nw) { const t = wm[nw[1]], c = d.getDay(), du = (t - c + 7) % 7 || 7; d.setDate(d.getDate() + du); }
  const dm = text.match(/(\d{1,2})月(\d{1,2})[日号]?/);
  if (dm) { d.setMonth(parseInt(dm[1]) - 1); d.setDate(parseInt(dm[2])); }
  let h = ref.getHours(), m = ref.getMinutes();
  const tm = text.match(/(\d{1,2})[点:：](\d{1,2})?/);
  if (tm) { h = parseInt(tm[1]); m = tm[2] ? parseInt(tm[2]) : 0; if (/(下午|晚上)/.test(text) && h < 12) h += 12; }
  if (/半/.test(text) && m === 0) m = 30;
  d.setHours(h, m, 0, 0); return d;
};

// 本地规则 (AI 不可用时)
window.Kawa.localParse = (text) => {
  if (/^(目标|标签)[：:]\s*(.+)/.test(text)) {
    const m = text.match(/^(目标|标签)[：:]\s*(.+)/);
    return { type: 'objective', ai_metadata: { title: m[2].trim(), color: window.Kawa.OBJ_PALETTE[Math.floor(Math.random() * window.Kawa.OBJ_PALETTE.length)] } };
  }
  const cleaned = text.replace(/[的了是就也会要能都去把被让到着在]/g, '').trim();
  const shortTitle = cleaned.length > 12 ? cleaned.substring(0, 11) + '…' : (cleaned || text.substring(0, 12));
  const isTodo = /要|去|记得|做|完成|写|整理|准备|列出|标注/.test(text) && !/完成了|做了|读了|跑了/.test(text);
  return { type: isTodo ? 'todo' : 'note', objective_id: null, ai_metadata: { task_title: shortTitle, progress_delta: isTodo ? 0 : 1 }, timeline_time: null };
};

// 关键词→目标匹配
window.Kawa.matchObj = (text, objs) => {
  for (const o of objs) {
    for (const kw of o.title.split(/[\s\-\—]+/)) {
      if (kw.length >= 2 && text.includes(kw)) return o.id;
    }
  }
  return null;
};
