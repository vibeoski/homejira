-- Add status column to tasks for multi-phase workflow (open, in_progress, on_hold, done)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'on_hold', 'done'));

-- Backfill from existing done boolean
UPDATE tasks SET status = CASE WHEN done THEN 'done' ELSE 'open' END;

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
