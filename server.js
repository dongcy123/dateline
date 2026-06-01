const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8765;
const HTML_FILE = path.join(__dirname, 'timeline.html');

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
        const { text, image_url, engine } = JSON.parse(body);
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
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: { code: 'bad_request', message: '需要提供 text 或 image_url' } }));
        }

        console.log(`[proxy] → ${engine}`);
        const aiRes = await fetch(targetUrl, { method: 'POST', headers, body: targetBody });
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

        let result;
        try {
          result = JSON.parse(content);
        } catch {
          result = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
        }

        // 服务端时间增强
        if (!result.timeline_time || result.timeline_time === 'null') {
          const localTime = parseChineseTime(text);
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

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', version: '2.0.0' }));
  }

  // Serve timeline.html for root
  if (url.pathname === '/' || url.pathname === '/index.html') {
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
