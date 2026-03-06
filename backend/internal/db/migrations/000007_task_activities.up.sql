CREATE TABLE task_activities (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    actor_id   UUID        REFERENCES members(id) ON DELETE SET NULL,
    kind       VARCHAR(50) NOT NULL,
    meta       JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_activities_task_id ON task_activities(task_id, created_at DESC);
