ALTER TABLE tasks DROP CONSTRAINT IF EXISTS fk_tasks_household;
DROP INDEX IF EXISTS idx_tasks_household_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS household_id;
