# 川上 (River of Time)

单页面极简个人管理系统 —— AI-powered bi-directional timeline with Supabase backend and DeepSeek AI.

## Tech Stack
- Frontend: `timeline.html` (纯 HTML/JS，React 18 + Babel standalone + Tailwind CDN)
- Server: `server.js` (零依赖 Node.js HTTP server，服务静态页面 + AI 代理)
- Backend: Supabase (PostgreSQL REST API)
- AI: DeepSeek API (text), Qwen-VL (vision)，通过 server.js 的 `/api/proxy` 代理调用
- Deploy: Render (`npm start` → `node server.js`)

## Quick Start
```bash
# 本地开发
node server.js
# 浏览器打开 http://localhost:8765

# AI 代理 (file:// 模式下需要)
python proxy-server.py

# 或直接打开 HTML
open timeline.html
```

## Project Structure
```
timeline.html     主应用 (所有前端逻辑)
server.js         HTTP server + AI 代理
proxy-server.py   Python AI 代理 (file:// 开发用)
supabase/         Migrations, Edge Functions
static/           React/Babel/Supabase SDK 本地备份
```

## 环境变量 (.env)
```
DEEPSEEK_API_KEY=      DeepSeek 文本 AI
VISION_API_KEY=        Qwen-VL 视觉 AI (DashScope)
EXPO_PUBLIC_SUPABASE_URL=    (已内嵌 fallback)
EXPO_PUBLIC_SUPABASE_ANON_KEY= (已内嵌 fallback)
```

Server 端通过 `process.env` 读取，`timeline.html` 不直接接触密钥 — 所有 AI 调用走 `/api/proxy`。

## 分支策略
- `master` — production
- `frsionos-redesign` — 现行稳定版
- `feat/*` — 功能分支，完成后合入 stable

## Testing
```bash
npx jest
```

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
