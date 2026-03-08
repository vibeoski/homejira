-- Allow tasks to be unassigned (assignee_id nullable).
-- Drops the NOT NULL constraint and changes ON DELETE CASCADE to SET NULL
-- so deleting a member doesn't cascade-delete their tasks.

ALTER TABLE tasks
    ALTER COLUMN assignee_id DROP NOT NULL;

ALTER TABLE tasks
    DROP CONSTRAINT IF EXISTS tasks_assignee_id_fkey;

ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_assignee
        FOREIGN KEY (assignee_id) REFERENCES members(id) ON DELETE SET NULL;
