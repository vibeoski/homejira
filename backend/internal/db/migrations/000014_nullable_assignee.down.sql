-- Revert: restore NOT NULL and CASCADE delete on assignee_id.
-- NOTE: this will fail if any tasks have assignee_id = NULL.

ALTER TABLE tasks
    DROP CONSTRAINT IF EXISTS fk_tasks_assignee;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_assignee_id_fkey
        FOREIGN KEY (assignee_id) REFERENCES members(id) ON DELETE CASCADE;

ALTER TABLE tasks
    ALTER COLUMN assignee_id SET NOT NULL;
