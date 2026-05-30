#!/usr/bin/env python3
"""
川上 AI 代理服务器 — 本地开发用
绕过 CORS 限制，转发请求到 DeepSeek 和 Qwen-VL。
启动: python proxy-server.py
端口: 8765
"""

import json, os, re, http.server, urllib.request, ssl, traceback
from datetime import datetime, timezone, timedelta

DEEPSEEK_KEY = os.environ.get("DEEPSEEK_API_KEY")
DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
VISION_KEY = os.environ.get("VISION_API_KEY")
VISION_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
VISION_MODEL = "qwen-vl-max"

CST = timezone(timedelta(hours=8))

SYSTEM_PROMPT = """你是《川上》个人战略执行系统的 AI 助手。分析用户输入，返回严格 JSON。

类型判断:
- todo: 待执行的行动、任务、计划
- note: 记录、想法、观察、已完成的事

输出格式:
{"type":"todo|note","objective_id":null,"ai_metadata":{"task":"摘要","progress_delta":数字,"tags":["标签"]},"timeline_time":"ISO 8601 或 null"}

progress_delta: 已完成且有数量→提取数字(如"标注10张"→10); 待做→0; 无数字→1
如果是创建目标/标签，type="objective"，ai_metadata={"title":"目标名","color":"#hex"}

时间提取:
- 绝对时间: "下午五点"→17:00, "上午九点"→09:00
- 相对时间: "昨晚八点"→昨天20:00, "明天上午十点"→明天10:00
- 日期+时间: "下周三下午3点"→推算日期, ISO 8601格式
- 无法提取则 timeline_time 为 null（前端用当前时间）

只返回 JSON，不要任何额外文字。"""


def parse_chinese_time(text: str) -> str | None:
    """服务端中文时间解析 — 提取明确的绝对/相对时间"""
    now = datetime.now(CST)

    # 日期偏移
    base = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if "大后天" in text:
        base = base + timedelta(days=3)
    elif "后天" in text:
        base = base + timedelta(days=2)
    elif "明天" in text or "明早" in text or "明晚" in text:
        base = base + timedelta(days=1)
    elif "昨天" in text or "昨晚" in text:
        base = base - timedelta(days=1)
    elif "前天" in text:
        base = base - timedelta(days=2)

    # 星期匹配
    weekdays = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0, "天": 0}
    m = re.search(r"(下?周)([一二三四五六日天])", text)
    if m:
        target = weekdays[m.group(2)]
        current = base.weekday()
        diff = (target - current) % 7
        if diff == 0:
            diff = 7
        if "下" in m.group(1):
            diff += 7
        base = base + timedelta(days=diff)

    # 月份日期
    m = re.search(r"(\d{1,2})月(\d{1,2})[日号]?", text)
    if m:
        try:
            base = base.replace(month=int(m.group(1)), day=int(m.group(2)))
        except ValueError:
            pass

    # 时间段
    is_pm = bool(re.search(r"下午|晚上|今晚|傍晚", text))
    is_am = bool(re.search(r"上午|早上|早晨|凌晨", text))

    # 提取小时
    hour = None
    minute = 0

    # 数字+点/时/:
    m = re.search(r"(\d{1,2})[点:：时](\d{1,2})?", text)
    if m:
        hour = int(m.group(1))
        if m.group(2):
            minute = int(m.group(2))
    elif "半" in text:
        # "五点半" → 5:30
        m = re.search(r"(\d{1,2})点半", text)
        if m:
            hour = int(m.group(1))
            minute = 30

    if hour is not None:
        if is_pm and hour < 12:
            hour += 12
        elif is_am and hour == 12:
            hour = 0
        elif hour <= 6 and not is_am and not is_pm:
            # 凌晨 1-6 点不转换(通常是下午时段)
            if hour >= 7:
                pass  # 保持原样

        # 处理中文数字+十二小时制的下午
        if "下午" in text or "晚上" in text:
            m_cn = re.search(r"下午(\d{1,2})", text)
            if m_cn:
                h = int(m_cn.group(1))
                if h < 12:
                    hour = h + 12

        base = base.replace(hour=hour, minute=minute)
        return base.isoformat()

    # 模糊时间
    if re.search(r"早上|早晨", text) and hour is None:
        base = base.replace(hour=8, minute=0)
        return base.isoformat()
    if re.search(r"上午", text) and hour is None:
        base = base.replace(hour=10, minute=0)
        return base.isoformat()
    if re.search(r"中午", text) and hour is None:
        base = base.replace(hour=12, minute=0)
        return base.isoformat()
    if re.search(r"下午", text) and hour is None:
        base = base.replace(hour=15, minute=0)
        return base.isoformat()
    if re.search(r"晚上|今晚", text) and hour is None:
        base = base.replace(hour=20, minute=0)
        return base.isoformat()

    # 没有明显时间标记 — 返回 None（前端用当前时间）
    if hour is None and not re.search(r"[点时:]|\d{1,2}月|周[一二三四五六日天]", text):
        return None

    return base.isoformat() if hour is not None else None


def call_deepseek(text: str) -> dict:
    """DeepSeek 文本解析 + 服务端时间增强"""
    now = datetime.now(CST)
    now_str = now.strftime("%Y-%m-%dT%H:%M:%S+08:00")

    req = urllib.request.Request(
        DEEPSEEK_URL,
        data=json.dumps({
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f'当前时间：{now_str}\n\n分析以下中文输入：\n\n"{text}"'},
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
    res = urllib.request.urlopen(req, timeout=60, context=ctx)
    data = json.loads(res.read())
    content = data["choices"][0]["message"]["content"]
    # 清理可能的 markdown 包裹
    cleaned = content.replace("```json\n", "").replace("```\n", "").replace("```", "").strip()
    result = json.loads(cleaned)

    # 服务端时间增强：如果 AI 没有返回有效时间，用本地解析补充
    ai_time = result.get("timeline_time")
    if not ai_time or ai_time == "null":
        local_time = parse_chinese_time(text)
        if local_time:
            result["timeline_time"] = local_time
            print(f"  [time] local parse → {local_time}")

    # 确保 objective_id 字段存在
    if "objective_id" not in result:
        result["objective_id"] = None

    return result


def call_vision(image_url: str) -> dict:
    """Qwen-VL 图像识别"""
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
    res = urllib.request.urlopen(req, timeout=60, context=ctx)
    data = json.loads(res.read())
    content = data["choices"][0]["message"]["content"]
    cleaned = content.replace("```json\n", "").replace("```\n", "").replace("```", "").strip()
    result = json.loads(cleaned)

    if "objective_id" not in result:
        result["objective_id"] = None

    return result


def validate_response(result: dict) -> dict:
    """标准化输出格式"""
    if "type" not in result:
        raise ValueError("AI 返回缺少 type 字段")
    if result["type"] not in ("todo", "note", "objective"):
        raise ValueError(f"无效 type: {result['type']}")

    return {
        "type": result.get("type", "note"),
        "objective_id": result.get("objective_id"),
        "ai_metadata": result.get("ai_metadata", {}),
        "timeline_time": result.get("timeline_time"),
    }


class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        """健康检查"""
        parsed = urllib.request.urlparse(self.path)
        if parsed.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ok",
                "engines": ["deepseek-chat", "qwen-vl-max"],
                "version": "2.0.0"
            }).encode())
            return
        self.send_error(404, "Not found")

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            body = json.loads(raw.decode("utf-8")) if length > 0 else {}

            text = body.get("text", "")
            image_url = body.get("image_url", "")
            engine = body.get("engine", "auto")

            # 智能路由
            if image_url and engine != "text":
                engine_name = "vision"
                result = call_vision(image_url)
            elif text:
                engine_name = "text"
                result = call_deepseek(text)
            else:
                self._error(400, "invalid_request", "需要提供 text 或 image_url")
                return

            # 验证并标准化
            validated = validate_response(result)

            print(f"[proxy] {engine_name} → type={validated['type']} "
                  f"time={validated.get('timeline_time','now')} "
                  f"text={text[:50] if text else '[image]'}")

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps(validated, ensure_ascii=False).encode("utf-8"))

        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            print(f"[proxy] HTTP {e.code}: {body[:200]}")
            if e.code == 401:
                self._error(401, "api_key_invalid", "API 密钥无效")
            elif e.code == 429:
                self._error(429, "rate_limit", "请求过于频繁，请稍后重试")
            else:
                self._error(502, "ai_api_error", f"AI API {e.code}: {body[:120]}")

        except json.JSONDecodeError as e:
            print(f"[proxy] JSON parse error: {e}")
            self._error(422, "parse_error", f"AI 返回了无效 JSON: {str(e)[:100]}")

        except ValueError as e:
            print(f"[proxy] Validation error: {e}")
            self._error(422, "parse_error", str(e))

        except Exception as e:
            print(f"[proxy] Internal error: {traceback.format_exc()}")
            self._error(500, "internal", str(e)[:200])

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey, x-client-info")
        self.send_header("Access-Control-Max-Age", "86400")

    def _error(self, status: int, code: str, message: str):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps({
            "error": {"code": code, "message": message}
        }, ensure_ascii=False).encode("utf-8"))

    def log_message(self, format, *args):
        pass  # 关闭默认 HTTP 日志


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8765))
    print(f"╔══════════════════════════════════════╗")
    print(f"║   川上 AI Proxy Server v2.0         ║")
    print(f"║   端口: {port}                        ║")
    print(f"║   文本: DeepSeek Chat               ║")
    print(f"║   视觉: Qwen-VL Max                 ║")
    print(f"║   http://localhost:{port}              ║")
    print(f"╚══════════════════════════════════════╝")
    print(f"  DEEPSEEK_KEY: {'✓' if DEEPSEEK_KEY else '✗'}")
    print(f"  VISION_KEY:   {'✓' if VISION_KEY else '✗'}")
    print()
    http.server.HTTPServer(("0.0.0.0", port), ProxyHandler).serve_forever()
