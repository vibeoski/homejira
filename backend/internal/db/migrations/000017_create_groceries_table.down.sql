-- Move data back
INSERT INTO tasks (id, title, notes, category, priority, assignee_id, done, done_at, created_at, updated_at, household_id, quantity)
SELECT id, title, notes, 'grocery', 'normal', assignee_id, done, done_at, created_at, updated_at, household_id, quantity
FROM groceries;

-- Update tasks check constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_category_check CHECK (category = ANY (ARRAY['grocery'::text, 'chore'::text, 'errand'::text, 'repair'::text]));

DROP TABLE IF EXISTS groceries;
