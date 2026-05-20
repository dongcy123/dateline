-- TimelineOS: 初始化数据库 Schema
-- 创建 timeline_events 表及索引、RLS 策略

-- 1. 建表
CREATE TABLE IF NOT EXISTS timeline_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_time TIMESTAMPTZ NOT NULL,
  record_time   TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_content   TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('expense', 'todo', 'note')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'done')),
  ai_metadata   JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 索引
CREATE INDEX idx_timeline_events_time ON timeline_events (timeline_time DESC);
CREATE INDEX idx_timeline_events_type ON timeline_events (type);
CREATE INDEX idx_timeline_events_status ON timeline_events (status);
CREATE INDEX idx_timeline_events_metadata ON timeline_events USING GIN (ai_metadata);

-- 3. Row Level Security
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

-- 允许所有操作 (单用户模式; 多用户时改为 user_id 匹配)
CREATE POLICY "Allow all on timeline_events"
  ON timeline_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. 注释
COMMENT ON TABLE timeline_events IS 'TimelineOS 时间轴事件表';
COMMENT ON COLUMN timeline_events.timeline_time IS '事件发生或计划的绝对时间，用于双向排序';
COMMENT ON COLUMN timeline_events.record_time IS '系统录入时间';
COMMENT ON COLUMN timeline_events.raw_content IS '原始输入内容，图片类型存 Supabase Storage URL';
COMMENT ON COLUMN timeline_events.type IS '事件类型: expense(支出) | todo(待办) | note(笔记)';
COMMENT ON COLUMN timeline_events.status IS '状态: pending(AI待确认) | confirmed(已确认) | done(已完成)';
COMMENT ON COLUMN timeline_events.ai_metadata IS 'AI 解析的结构化数据，格式取决于 type';
