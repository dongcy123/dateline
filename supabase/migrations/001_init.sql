-- TimelineOS: 初始化数据库 Schema
-- 创建 timeline_events 和 objectives 表及索引、RLS 策略

-- 1. 目标表
CREATE TABLE IF NOT EXISTS objectives (
  id        TEXT PRIMARY KEY,
  title     TEXT NOT NULL,
  target    INTEGER NOT NULL DEFAULT 100,
  current   INTEGER NOT NULL DEFAULT 0,
  color     TEXT NOT NULL DEFAULT '#8B7FB8',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 事件表
CREATE TABLE IF NOT EXISTS timeline_events (
  id            TEXT PRIMARY KEY,
  timeline_time TIMESTAMPTZ NOT NULL,
  record_time   TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_content   TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('todo', 'note')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  objective_id  TEXT REFERENCES objectives(id) ON DELETE SET NULL,
  ai_metadata   JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_events_time ON timeline_events (timeline_time DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON timeline_events (type);
CREATE INDEX IF NOT EXISTS idx_events_status ON timeline_events (status);
CREATE INDEX IF NOT EXISTS idx_events_obj ON timeline_events (objective_id);
CREATE INDEX IF NOT EXISTS idx_events_metadata ON timeline_events USING GIN (ai_metadata);
CREATE INDEX IF NOT EXISTS idx_obj_updated ON objectives (updated_at DESC);

-- 4. Row Level Security
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;

-- 允许所有操作 (单用户模式; 多用户时改为 user_id 匹配)
CREATE POLICY "Allow all on timeline_events"
  ON timeline_events FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on objectives"
  ON objectives FOR ALL USING (true) WITH CHECK (true);

-- 5. 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_obj_updated ON objectives;
CREATE TRIGGER trg_obj_updated
  BEFORE UPDATE ON objectives
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. 注释
COMMENT ON TABLE timeline_events IS '时间轴事件表';
COMMENT ON COLUMN timeline_events.timeline_time IS '事件发生的绝对时间，用于双向排序';
COMMENT ON COLUMN timeline_events.record_time IS '系统录入时间';
COMMENT ON COLUMN timeline_events.raw_content IS '原始输入内容';
COMMENT ON COLUMN timeline_events.type IS '事件类型: todo(待办) | note(笔记)';
COMMENT ON COLUMN timeline_events.status IS '状态: pending(待确认) | done(已完成)';
COMMENT ON COLUMN timeline_events.ai_metadata IS 'AI 解析的结构化数据';

COMMENT ON TABLE objectives IS 'OKR 目标表';
COMMENT ON COLUMN objectives.target IS '目标总量';
COMMENT ON COLUMN objectives.current IS '当前进度';
COMMENT ON COLUMN objectives.color IS '主题色 hex';
