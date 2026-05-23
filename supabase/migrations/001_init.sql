-- Fix schema: recreate timeline_events with correct columns, create objectives
-- Data has been cleared, so DROP is safe

-- 1. Drop existing timeline_events (schema mismatch)
DROP TABLE IF EXISTS timeline_events;

-- 2. Create objectives table
CREATE TABLE IF NOT EXISTS objectives (
  id        TEXT PRIMARY KEY,
  title     TEXT NOT NULL,
  target    INTEGER NOT NULL DEFAULT 100,
  current   INTEGER NOT NULL DEFAULT 0,
  color     TEXT NOT NULL DEFAULT '#8B7FB8',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create timeline_events with full schema
CREATE TABLE timeline_events (
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

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_events_time ON timeline_events (timeline_time DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON timeline_events (type);
CREATE INDEX IF NOT EXISTS idx_events_status ON timeline_events (status);
CREATE INDEX IF NOT EXISTS idx_events_obj ON timeline_events (objective_id);
CREATE INDEX IF NOT EXISTS idx_obj_updated ON objectives (updated_at DESC);

-- 5. Row Level Security
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on timeline_events" ON timeline_events;
CREATE POLICY "Allow all on timeline_events"
  ON timeline_events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on objectives" ON objectives;
CREATE POLICY "Allow all on objectives"
  ON objectives FOR ALL USING (true) WITH CHECK (true);

-- 6. Auto-update updated_at trigger
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
