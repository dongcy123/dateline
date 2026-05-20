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
};

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
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // AI Proxy endpoint — forwards to DeepSeek or Vision API
  if (url.pathname === '/api/proxy' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { text, image_url, engine } = JSON.parse(body);
        let targetUrl, targetBody, headers;

        if (engine === 'vision' && image_url) {
          // Vision API (Qwen-VL / GPT-4o)
          const visionBaseUrl = process.env.VISION_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
          const visionKey = process.env.VISION_KEY;
          const visionModel = process.env.VISION_MODEL || 'qwen-vl-max';
          if (!visionKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: { code: 'api_key_missing', message: '服务端未配置视觉 API 密钥' } }));
          }
          targetUrl = `${visionBaseUrl}/chat/completions`;
          headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${visionKey}` };
          targetBody = JSON.stringify({
            model: visionModel,
            messages: [
              { role: 'system', content: '你是一个个人管理助手。分析用户输入并返回严格的 JSON。规则：1. 金额/消费 → type: "expense"，ai_metadata: {"amount": 数字, "tag": "标签"} 2. 任务/待办 → type: "todo"，ai_metadata: {"task": "任务名", "priority": "high|normal|low"} 3. 其他 → type: "note"，ai_metadata: {"summary": "摘要"}。只返回 JSON。' },
              { role: 'user', content: [{ type: 'image_url', image_url: { url: image_url } }, { type: 'text', text: '请识别这张图片并提取结构化信息。如果是收据/小票，提取金额和分类。如果是海报/文档，提取关键信息。' }] }
            ],
            temperature: 0.3,
          });
        } else if (engine === 'text' && text) {
          // DeepSeek API
          const deepseekKey = process.env.DEEPSEEK_KEY;
          if (!deepseekKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: { code: 'api_key_missing', message: '服务端未配置 DeepSeek API 密钥' } }));
          }
          targetUrl = 'https://api.deepseek.com/v1/chat/completions';
          headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekKey}` };
          targetBody = JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: '你是一个个人管理助手。分析用户输入并返回严格的 JSON。规则：1. 如果涉及金额、消费、购物 → type: "expense"，ai_metadata: {"amount": 数字, "tag": "餐饮|购物|交通|娱乐|教育|其他"} 2. 如果是任务、待办、提醒 → type: "todo"，ai_metadata: {"task": "任务名", "priority": "high|normal|low"} 3. 其他记录、想法、笔记 → type: "note"，ai_metadata: {"summary": "摘要"}。只返回 JSON。' },
              { role: 'user', content: `分析以下中文输入，判断类型并提取结构化数据：\n\n"${text}"` },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
          });
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: { code: 'bad_request', message: '需要提供 text 或 image_url' } }));
        }

        const aiRes = await fetch(targetUrl, { method: 'POST', headers, body: targetBody });
        const aiData = await aiRes.json();

        if (!aiRes.ok) {
          res.writeHead(aiRes.status, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: { code: 'ai_api_error', message: `AI API 错误 (${aiRes.status})` } }));
        }

        const content = aiData.choices?.[0]?.message?.content;
        if (!content) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: { code: 'parse_error', message: 'AI 返回为空' } }));
        }

        let result;
        try {
          result = JSON.parse(content);
        } catch {
          result = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'internal', message: err.message } }));
      }
    });
    return;
  }

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  // Serve timeline.html for root
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return serveFile(res, HTML_FILE);
  }

  // Serve any other file from the project root (for assets)
  const filePath = path.join(__dirname, url.pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return serveFile(res, filePath);
  }

  notFound(res);
});

server.listen(PORT, () => {
  console.log(`川上 running on port ${PORT}`);
  console.log(`Proxy: ${process.env.DEEPSEEK_KEY ? 'DeepSeek ✓' : 'DeepSeek ✗'}`);
  console.log(`Proxy: ${process.env.VISION_KEY ? 'Vision ✓' : 'Vision ✗'}`);
});
