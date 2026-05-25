-- Add is_key_node column to timeline_events
-- Only key node events contribute progress_delta to objectives

ALTER TABLE timeline_events
  ADD COLUMN IF NOT EXISTS is_key_node BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_events_key_node ON timeline_events (objective_id, is_key_node);
