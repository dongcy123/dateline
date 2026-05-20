# Project Name: TimelineOS (单页面极简个人管理系统)

## 1. 技术栈与双引擎架构 (Tech Stack & Dual-Engine)
- **前端框架**：Expo + React Native (单页面状态驱动，无底部 Tab 栏)
- **数据库**：Supabase (PostgreSQL)
- **双大模型分流机制 (Dual-Engine Proxy)**：
  - **文本/语音通道**：调用 **DeepSeek API**，处理纯文本和语音转文字（ASR）的意图提取。
  - **图像通道**：调用 **视觉多模态大模型 API（如 Qwen-VL / Kimi）**，直接识别图片（小票/海报）并转化为结构化数据。
  - **核心要求**：无论走哪个通道，最终返回给前端的必须是格式完全一致的标准化 JSON。

## 2. 核心 UI 架构
1. **HUD Header (顶部)**：悬浮半透明状态条（展示预算血条/任务经验条）。下拉触发下拉动画，拉出“本月热力图日历 (Heatmap)”。
2. **Bi-directional Feed (中部)**：双向时间轴。
   - 以 `Now (当前时间)` 为屏幕轴心。
   - 向下滑动：加载历史记录 (Type: expense, todo, note)。
   - 向上滑动：加载未来计划 (Type: todo)。
   - 状态逻辑：AI 新生成的卡片默认为 `pending`（前端呈现高亮发光特效，带 [✓确认] 按钮），确认后变为 `confirmed` 或 `done`。
3. **Omnibox (底部)**：全局悬浮输入框，左侧 `[+]` 唤起相机/相册（触发视觉引擎），右侧 `[麦克风]` 触发系统原生语音转文字（触发文本引擎）。

## 3. 数据库 Schema (`timeline_events`)
- `id`: UUID (PK)
- `timeline_time`: Timestamptz (事件发生或计划的绝对时间，用于双向排序)
- `record_time`: Timestamptz (系统录入时间)
- `raw_content`: Text (原始输入，如果是图片则存图片在 Supabase Storage 的 URL)
- `type`: String ('expense' | 'todo' | 'note')
- `status`: String ('pending' | 'confirmed' | 'done')
- `ai_metadata`: JSONB
  - expense: { "amount": number, "tag": string }
  - todo: { "task": string, "priority": "high"|"normal"|"low" }
  - note: {}