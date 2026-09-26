-- 仅用于旧库（只有旧 ai_calls/events 两表）的一次性升级。
-- SQLite/D1 不支持 IF NOT EXISTS ADD COLUMN；已升级过的库不要重复执行。
ALTER TABLE events ADD COLUMN execution_id TEXT;
ALTER TABLE events ADD COLUMN module TEXT;
ALTER TABLE events ADD COLUMN event_date TEXT;
UPDATE events SET execution_id = lower(hex(randomblob(16))) WHERE execution_id IS NULL;
UPDATE events SET module = 'legacy' WHERE module IS NULL;
UPDATE events SET event_date = substr(created_at, 1, 10) WHERE event_date IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_execution_event ON events(execution_id, event);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_calls_created_at ON ai_calls(created_at);

CREATE TABLE IF NOT EXISTS installations (
  installation_id TEXT PRIMARY KEY, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_installations (
  event_date TEXT NOT NULL, installation_id TEXT NOT NULL, first_seen_at TEXT NOT NULL,
  PRIMARY KEY(event_date, installation_id)
);
CREATE TABLE IF NOT EXISTS daily_metrics (
  event_date TEXT NOT NULL, module TEXT NOT NULL, event TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(event_date, module, event)
);
CREATE TABLE IF NOT EXISTS ai_quota_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, installation_id TEXT NOT NULL, module TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quota_installation_created ON ai_quota_attempts(installation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_quota_created ON ai_quota_attempts(created_at);
