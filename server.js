const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8765;
const HTML_FILE = path.join(__dirname, 'index.html');
const V1_FILE = path.join(__dirname, 'v1.html');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
};

// AI Proxy — DeepSeek text + Qwen-VL vision
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const VISION_KEY = process.env.VISION_API_KEY;
const VISION_MODEL = process.env.VISION_MODEL || 'qwen-vl-max';
const VISION_BASE_URL = process.env.VISION_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const SB_KEY = 'sb_publishable_8q1OXyDCIo6wcn82ReOa4w_-3azo0lH';
const SB_URL = 'https://gduqrtzoggpjyifxvzxy.supabase.co';

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

function parseChineseTime(text) {
  const now = new Date();
  let base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (/大后天/.test(text)) base.setDate(base.getDate() + 3);
  else if (/后天/.test(text)) base.setDate(base.getDate() + 2);
  else if (/明天|明早|明晚/.test(text)) base.setDate(base.getDate() + 1);
  else if (/昨天|昨晚/.test(text)) base.setDate(base.getDate() - 1);
  else if (/前天/.test(text)) base.setDate(base.getDate() - 2);

  const weekMap = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':0,'天':0 };
  const mw = text.match(/(下?周)([一二三四五六日天])/);
  if (mw) {
    const target = weekMap[mw[2]];
    const current = base.getDay();
    let diff = (target - current + 7) % 7;
    if (diff === 0) diff = 7;
    if (mw[1].startsWith('下')) diff += 7;
    base.setDate(base.getDate() + diff);
  }

  const dm = text.match(/(\d{1,2})月(\d{1,2})[日号]?/);
  if (dm) { base.setMonth(parseInt(dm[1])-1); base.setDate(parseInt(dm[2])); }

  let h = null, m = 0;
  const tm = text.match(/(\d{1,2})[点:：时](\d{1,2})?/);
  if (tm) { h = parseInt(tm[1]); if (tm[2]) m = parseInt(tm[2]); }
  if (/半/.test(text) && m === 0) m = 30;

  const isPM = /下午|晚上|今晚|傍晚/.test(text);
  const isAM = /上午|早上|早晨|凌晨/.test(text);

  if (h !== null) {
    if (isPM && h < 12) h += 12;
    else if (isAM && h === 12) h = 0;
    base.setHours(h, m, 0, 0);
    return base.toISOString();
  }

  return null;
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { code: 'not_found', message: 'Not found' } }));
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // AI Proxy endpoint (root + /api/proxy for compatibility)
  if ((url.pathname === '/' || url.pathname === '/api/proxy') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        const { text, image_url, engine } = parsed;
        console.log(`[proxy] raw engine=${engine} text=${(text||'').substring(0,40)} hasHistory=${!!parsed.history} bodyKeys=${Object.keys(parsed).join(',')}`);
        let targetUrl, targetBody, headers;

        if (engine === 'vision' && image_url) {
          if (!VISION_KEY) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: { code: 'api_key_missing', message: '未配置视觉 API 密钥' } }));
          }
          targetUrl = `${VISION_BASE_URL}/chat/completions`;
          headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${VISION_KEY}` };
          targetBody = JSON.stringify({
            model: VISION_MODEL,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: [{ type: 'image_url', image_url: { url: image_url } }, { type: 'text', text: '请识别这张图片并提取结构化信息。' }] }
            ],
            temperature: 0.3,
          });
        } else if (engine === 'text' && text) {
          if (!DEEPSEEK_KEY) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: { code: 'api_key_missing', message: '未配置 DeepSeek API 密钥' } }));
          }
          const now = new Date();
          const nowStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00+08:00`;
          targetUrl = 'https://api.deepseek.com/v1/chat/completions';
          headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` };
          targetBody = JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: `当前时间：${nowStr}\n\n分析以下中文输入：\n\n"${text}"` },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
          });
        } else if (engine === 'chat' && body.history) {
          if (!DEEPSEEK_KEY) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: { code: 'api_key_missing', message: '未配置 DeepSeek API 密钥' } }));
          }
          const now = new Date();
          const nowStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00+08:00`;
          const chatMessages = [
            { role: 'system', content: `你是《川上》个人战略执行系统的 AI 对谈助手。当前时间：${nowStr}。

你的风格：简洁、温和、有洞察。每次回复控制在 2-4 句话。
引导用户梳理今天做了什么、明天计划什么。当用户提到具体任务或事件时，主动询问是否需要提炼成时间线卡片。
用户说"完成"或"就这样"时，提醒点击"完成提炼"按钮生成卡片。
不要输出 JSON，只输出自然语言。` },
            ...body.history
          ];
          targetUrl = 'https://api.deepseek.com/v1/chat/completions';
          headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` };
          targetBody = JSON.stringify({
            model: 'deepseek-chat',
            messages: chatMessages,
            temperature: 0.7,
          });
        } else if (engine === 'extract' && body.history) {
          if (!DEEPSEEK_KEY) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: { code: 'api_key_missing', message: '未配置 DeepSeek API 密钥' } }));
          }
          const now = new Date();
          const nowStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00+08:00`;
          const convoText = body.history.map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`).join('\n\n');
          targetUrl = 'https://api.deepseek.com/v1/chat/completions';
          headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` };
          targetBody = JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: `你是《川上》个人战略执行系统的提炼引擎。当前时间：${nowStr}。

分析以下对话，从中提取所有值得沉淀的任务和笔记。返回严格 JSON：

{"events":[{"type":"todo|note","raw_content":"对应用户原文","ai_metadata":{"task_title":"精炼12字标题","progress_delta":数字},"timeline_time":"ISO 8601 或 null"}]}

规则：
- task_title: 去口语化、动作导向，12 字以内，绝不复制原文
- progress_delta: 已完成且有数量→提取数字，待做→0，无数字→1
- timeline_time: 提取对话中提到的时间，无法提取则为 null
- type: 待做/任务→"todo"，记录/已完成/想法→"note"
- 无关闲聊、寒暄、情感安抚不要提取
- 只返回 JSON，不要任何额外文字。` },
              { role: 'user', content: convoText }
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
          });
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: { code: 'bad_request', message: '需要提供 text, image_url 或 history' } }));
        }

        console.log(`[proxy] → ${engine}`);
        const isChat = engine === 'chat';
        const isExtract = engine === 'extract';

        const t0 = Date.now();
        console.log(`[proxy] → ${engine}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);
        let aiRes;
        try {
          aiRes = await fetch(targetUrl, { method: 'POST', headers, body: targetBody, signal: controller.signal });
        } finally {
          clearTimeout(timeout);
        }
        const t1 = Date.now();
        console.log(`[proxy] ${engine} upstream responded in ${t1 - t0}ms`);
        const aiText = await aiRes.text();

        if (!aiRes.ok) {
          console.error(`[proxy] upstream ${aiRes.status}:`, aiText.substring(0, 300));
          const status = aiRes.status === 401 ? 401 : aiRes.status === 429 ? 429 : 502;
          res.writeHead(status, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: { code: aiRes.status === 401 ? 'api_key_invalid' : aiRes.status === 429 ? 'rate_limit' : 'ai_api_error', message: `AI API ${aiRes.status}: ${aiText.substring(0, 120)}` } }));
        }

        let aiData;
        try { aiData = JSON.parse(aiText); } catch {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: { code: 'bad_upstream', message: 'AI 返回非 JSON' } }));
        }

        const content = aiData.choices?.[0]?.message?.content;
        if (!content) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: { code: 'empty_response', message: 'AI 返回为空' } }));
        }

        // Chat mode: return natural language reply as-is
        if (isChat) {
          console.log(`[proxy] ✓ chat → ${content.substring(0, 60)}...`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ reply: content }));
        }

        // Extract mode: parse JSON events array
        if (isExtract) {
          let parsed;
          try {
            parsed = JSON.parse(content);
          } catch {
            parsed = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
          }
          const events = (parsed.events || []).map(e => ({
            ...e,
            objective_id: e.objective_id || null
          }));
          console.log(`[proxy] ✓ extract → ${events.length} events`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ events }));
        }

        // Text/Vision mode: parse single event JSON
        let result;
        try {
          result = JSON.parse(content);
        } catch {
          result = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
        }

        // 服务端时间增强
        if (!result.timeline_time || result.timeline_time === 'null') {
          const localTime = parseChineseTime(text || '');
          if (localTime) result.timeline_time = localTime;
        }
        if (!result.objective_id) result.objective_id = null;

        console.log(`[proxy] ✓ ${engine} → ${result.type} time=${result.timeline_time||'now'}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));

      } catch (err) {
        console.error('[proxy] internal:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'internal', message: err.message } }));
      }
    });
    return;
  }

  // Supabase REST proxy — 浏览器在国内无法直连 Supabase
  if (url.pathname.startsWith('/api/sb/')) {
    const sbPath = url.pathname.replace('/api/sb', '') + url.search;
    const sbUrl = SB_URL + sbPath;

    const proxyReq = async () => {
      try {
        const headers = {
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + SB_KEY,
          'Prefer': req.headers['prefer'] || 'return=minimal',
        };

        const fetchOpts = { method: req.method, headers };
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          // Read body as binary Buffer (not string) to support image uploads
          const chunks = [];
          fetchOpts.body = await new Promise((resolve, reject) => {
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => resolve(Buffer.concat(chunks)));
            req.on('error', reject);
          });
          if (req.headers['content-type']) {
            headers['Content-Type'] = req.headers['content-type'];
          }
        }

        const sbCtrl = new AbortController(); const sbT = setTimeout(() => sbCtrl.abort(), 15000);
        const upstream = await fetch(sbUrl, { ...fetchOpts, signal: sbCtrl.signal }); clearTimeout(sbT);

        // For images, pipe as binary; for JSON, read as text
        const ct = upstream.headers.get('content-type') || '';
        if (ct.startsWith('image/') || req.url.includes('/storage/')) {
          const buf = await upstream.arrayBuffer();
          res.writeHead(upstream.status, {
            'Content-Type': ct,
            'Content-Length': buf.byteLength,
            'Access-Control-Allow-Origin': '*',
          });
          res.end(Buffer.from(buf));
        } else {
          const resBody = await upstream.text();
          res.writeHead(upstream.status, {
            'Content-Type': ct || 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(resBody);
        }
      } catch (err) {
        console.error('[sb-proxy]', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'proxy_error', message: err.message } }));
      }
    };
    proxyReq();
    return;
  }

  // Debug: test DeepSeek connectivity
  if (url.pathname === '/api/debug') {
    (async () => {
      const results = { deepseek_key: !!DEEPSEEK_KEY, vision_key: !!VISION_KEY, tests: {} };
      if (DEEPSEEK_KEY) {
        try {
          const t0 = Date.now();
          const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
            body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }], max_tokens: 10 }),
            signal: AbortSignal.timeout(10000),
          });
          const d = await r.json();
          results.tests.deepseek = {
            status: r.status,
            latency_ms: Date.now() - t0,
            reply: d.choices?.[0]?.message?.content?.substring(0, 50),
            error: d.error?.message || null,
          };
        } catch (e) {
          results.tests.deepseek = { status: 'fetch_failed', error: e.message };
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(results));
    })();
    return;
  }

  // Keepalive — prevents Render cold-start + Supabase pause. Ping via Render Cron Job every 10 min.
  if (url.pathname === '/api/keepalive') {
    (async () => {
      let sbOk = false;
      try {
        const r = await fetch(SB_URL + '/rest/v1/timeline_events?limit=1', {
          headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
          signal: AbortSignal.timeout(10000),
        });
        sbOk = r.ok;
      } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, sb: sbOk ? 'up' : 'down', ts: new Date().toISOString() }));
    })();
    return;
  }

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', version: '2.0.0' }));
  }

  // Serve v1.0 for root, old timeline at /index.html
  if (url.pathname === '/') {
    return serveFile(res, V1_FILE);
  }
  if (url.pathname === '/index.html' || url.pathname === '/timeline') {
    return serveFile(res, HTML_FILE);
  }

  // Serve static files from project root
  const filePath = path.join(__dirname, url.pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return serveFile(res, filePath);
  }

  notFound(res);
});

server.listen(PORT, () => {
  console.log(`╔══════════════════════════════════════╗`);
  console.log(`║   川上 Server v2.0                   ║`);
  console.log(`║   端口: ${PORT}                        ║`);
  console.log(`║   http://localhost:${PORT}              ║`);
  console.log(`╚══════════════════════════════════════╝`);
  console.log(`  DEEPSEEK_KEY: ${DEEPSEEK_KEY ? '✓' : '✗'}`);
  console.log(`  VISION_KEY:   ${VISION_KEY ? '✓' : '✗'}`);
});
