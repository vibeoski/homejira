-- Add household_id to tasks (nullable so existing rows are preserved;
-- the application enforces membership via JWT before returning tasks).
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS household_id UUID;

ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_household
        FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_household_id ON tasks(household_id);
