#!/usr/bin/env python3
"""
TimelineOS — 本地 AI 代理服务器
绕过 CORS 限制，在本地转发请求到 DeepSeek 和 Vision API。
启动: python proxy-server.py
端口: 8765
"""

import json
import os
import http.server
import urllib.request
import ssl

DEEPSEEK_KEY = "sk-59667e37ac864780895095182443388f"
DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
VISION_KEY = "sk-9069631b201a4f5997a10682ff399dba"
VISION_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
VISION_MODEL = "qwen-vl-max"

SYSTEM_PROMPT = """你是一个个人管理助手。分析用户输入并返回严格的 JSON。

规则：
1. 如果涉及金额、消费、购物 → type: "expense"，ai_metadata: {"amount": 数字, "tag": "餐饮|购物|交通|娱乐|教育|其他"}
2. 如果是任务、待办、提醒、计划 → type: "todo"，ai_metadata: {"task": "任务名", "priority": "high|normal|low"}
3. 其他记录、想法、笔记、灵感 → type: "note"，ai_metadata: {"summary": "摘要"}

**时间提取（关键）：**
- 从用户输入中提取事件发生的真实时间，作为 timeline_time 字段
- 支持：绝对时间（"下午五点"→17:00）、相对时间（"昨晚八点"→昨天的20:00、"明天上午"→明天的上午）、日期+时间（"下周三下午3点"）
- timeline_time 必须是 ISO 8601 格式字符串（如 "2026-05-20T17:00:00+08:00"）
- 如果用户没有指定时间，使用当前时间
- 消费记录用发生时间，待办用计划执行时间，笔记用灵感产生时间

只返回 JSON，不要任何额外文字。"""


def call_deepseek(text):
    """文本 → DeepSeek（含时间提取）"""
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone(timedelta(hours=8)))  # CST
    now_str = now.strftime("%Y-%m-%dT%H:%M:%S+08:00")

    req = urllib.request.Request(
        DEEPSEEK_URL,
        data=json.dumps({
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f'当前时间：{now_str}\n\n分析以下中文输入，提取事件类型、结构化数据、以及事件发生的真实时间：\n\n"{text}"'},
            ],
            "temperature": 0.3,
            "response_format": {"type": "json_object"},
        }).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DEEPSEEK_KEY}",
        },
    )
    ctx = ssl.create_default_context()
    res = urllib.request.urlopen(req, timeout=30, context=ctx)
    data = json.loads(res.read())
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def call_vision(image_url):
    """图像 → Vision Model"""
    req = urllib.request.Request(
        VISION_URL,
        data=json.dumps({
            "model": VISION_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_url}},
                        {"type": "text", "text": "请识别这张图片并提取结构化信息。如果是收据/小票，提取金额和分类。如果是海报/文档，提取关键信息。"},
                    ],
                },
            ],
            "temperature": 0.3,
        }).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {VISION_KEY}",
        },
    )
    ctx = ssl.create_default_context()
    res = urllib.request.urlopen(req, timeout=30, context=ctx)
    data = json.loads(res.read())
    content = data["choices"][0]["message"]["content"]
    # Vision models may wrap JSON in markdown
    cleaned = content.replace("```json\n", "").replace("```\n", "").replace("```", "").strip()
    return json.loads(cleaned)


class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_cors()
        self.end_headers()

    def do_POST(self):
        try:
            # Read request body with proper UTF-8 decoding
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            body = json.loads(raw.decode('utf-8')) if length > 0 else {}

            text = body.get("text", "")
            image_url = body.get("image_url", "")
            engine = body.get("engine", "auto")

            print(f"[Proxy] engine={engine} text={text[:40] if text else ''} image={bool(image_url)}")

            # Route to appropriate AI engine
            if image_url and engine != "text":
                result = call_vision(image_url)
            elif text:
                result = call_deepseek(text)
            else:
                self.send_error(400, json.dumps({"error": {"code": "invalid_request", "message": "Must provide text or image_url"}}))
                return

            # Validate and return
            if "type" not in result or "ai_metadata" not in result:
                self.send_error(422, json.dumps({"error": {"code": "parse_error", "message": "AI returned invalid format"}}))
                return

            timeline = result.get('timeline_time', '')
            print(f"[Proxy] -> type={result.get('type')} time={timeline} meta={json.dumps(result.get('ai_metadata',{}), ensure_ascii=False)[:80]}")

            resp = {
                "type": result.get("type", "note"),
                "ai_metadata": result.get("ai_metadata", {}),
                "timeline_time": timeline or None,  # None = use current time
            }

            self.send_response(200)
            self.send_cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(resp, ensure_ascii=False).encode("utf-8"))

        except Exception as e:
            msg = str(e)
            print(f"[Proxy] ERROR: {msg}")
            self.send_error(500, json.dumps({"error": {"code": "api_error", "message": msg}}))

    def send_cors(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Max-Age", "86400")

    def log_message(self, format, *args):
        pass  # Suppress default logs


if __name__ == "__main__":
    port = 8765
    print(f"╔══════════════════════════════════════╗")
    print(f"║   TimelineOS AI Proxy Server        ║")
    print(f"║   端口: {port}                        ║")
    print(f"║   引擎: DeepSeek + Qwen-VL          ║")
    print(f"║   http://localhost:{port}              ║")
    print(f"╚══════════════════════════════════════╝")
    print()
    http.server.HTTPServer(("0.0.0.0", port), ProxyHandler).serve_forever()
