# 川上 (River of Time)

AI-powered 个人管理系统 —— v1.0 双模块布局 · Supabase + DeepSeek AI

## Tech Stack
- **Frontend**: `web/` — Vite + React 19 + TypeScript + shadcn/ui + Tailwind CSS 3
- **Server**: `server.js` — 零依赖 Node.js HTTP server，服务静态页面 + AI 代理
- **Backend**: Supabase (PostgreSQL REST API)
- **AI**: DeepSeek API (text), Qwen-VL (vision)，通过 `server.js` 的 `/api/proxy` 代理
- **Deploy**: Render (`npm start` → `node server.js`)

## Quick Start
```bash
# 安装依赖（仅首次）
cd web && npm install

# 本地开发 — 终端1：API 代理
node server.js

# 终端2：Vite dev server (HMR + /api proxy → :8765)
cd web && npm run dev
# → http://localhost:5173

# 生产构建
cd web && npm run build
node server.js          # http://localhost:8765
```

## Project Structure
```
web/                    主前端 (Vite + React + TypeScript + shadcn/ui)
├── src/
│   ├── main.tsx         ReactDOM entry
│   ├── App.tsx          根组件 — v1.0 双模块布局
│   ├── index.css        Tailwind + shadcn HSL CSS 变量
│   ├── components/
│   │   ├── ui/          shadcn/ui 组件 (button, input, textarea, checkbox,
│   │   │                badge, select, dialog, card, separator, tooltip)
│   │   ├── Top3Focus.tsx      模块一：Top 3 待办 (pastel 便利贴 · 横向滚动)
│   │   ├── TagNav.tsx         Tag 导航栏 (从 objectives 生成 chips)
│   │   ├── MasonryCard.tsx    模块二：瀑布流卡片 (笔记文章卡 / 待办便利贴)
│   │   ├── CardDetail.tsx     卡片详情浮层 (多图 · 编辑 · 置顶 · 删除)
│   │   ├── Omnibox.tsx        底部输入栏 + 语音
│   │   └── VoiceButton.tsx    Web Speech API 语音按钮
│   ├── hooks/
│   │   └── useScrollCollapse.ts
│   ├── lib/
│   │   ├── supabase.ts   Supabase 客户端 (SDK + REST 双通道)
│   │   ├── ai.ts         AI 引擎 (callAI, parseTime, localParse)
│   │   ├── storage.ts    localStorage 封装
│   │   ├── sync.ts       离线同步队列 (指数退避重试)
│   │   ├── utils.ts      uid, fmtTime, fmtDate, tsDay
│   │   ├── constants.ts  OBJ_PALETTE, TYPE_LABELS, 存储 key
│   │   └── cn.ts         shadcn cn() utility (clsx + tailwind-merge)
│   └── types/
│       ├── event.ts      TimelineEvent, Objective 类型
│       └── ai.ts         AIProxyRequest/Response 类型
├── components.json       shadcn/ui 配置
├── tailwind.config.ts    Lavender 色板 + shadcn CSS 令牌
├── vite.config.ts        Vite config + /api proxy
└── package.json

server.js                HTTP server + AI 代理 (/api/proxy)
render.yaml              Render 部署配置
package.json             根 package (npm start / npm run build)

timeline.html            旧版 (垂直时间轴，保留作为参考)
v1.html                  旧版 v1.0 wrapper (CDN 架构，保留作为参考)
app-v1.js                旧版 v1.0 主逻辑 (CDN 架构)
components/              旧版组件 (CDN 架构，仅参考)
├── top3.js, masonry-card.js, card-detail.js, post-editor.js
├── calendar-heatmap.js, omnibox.js, storage.js, ai.js, icons.js

supabase/                Migrations, Edge Functions
static/                  React/Babel/Supabase SDK 本地备份 (旧 CDN 架构用)
```

## v1.0 布局说明
```
┌─ Header: "川上" + v1.0 徽标 ──────────────────┐
├─ 模块一：Top 3 待办 ───────────────────────────┤
│  pastel 便利贴横向滚动 (黄/粉/绿/紫)            │
│  点击完成 → 缩放消失动画 + 从列表移除           │
├─ Tag 导航栏 ──────────────────────────────────┤
│  从 objectives 生成 chips，横向滚动，点击过滤   │
├─ 模块二：沉淀瀑布流 ───────────────────────────┤
│  2 列 Masonry 布局，置顶优先，record_time 倒序  │
│  · 笔记卡：白底 + 左色条 + 可选图片 + 大标题    │
│  · 待办卡：pastel 底色便利贴 (88% 宽，居中)     │
│  点击卡片 → CardDetail 全屏浮层                  │
├─ FAB [+] ─────────────────────────────────────┤
│  选图 → PostEditor / 纯文本                     │
├─ Omnibox ─────────────────────────────────────┤
│  文本输入 + 语音 / "/目标 名称" 创建目标         │
└────────────────────────────────────────────────┘
```

## 环境变量 (.env)
```
DEEPSEEK_API_KEY=      DeepSeek 文本 AI
VISION_API_KEY=        Qwen-VL 视觉 AI (DashScope)
```

## 分支策略
- `master` — production
- `feat/*` — 功能分支

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
