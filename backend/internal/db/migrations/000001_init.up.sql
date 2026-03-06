-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Members table
CREATE TABLE IF NOT EXISTS members (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    avatar     TEXT        NOT NULL DEFAULT '🧑',
    color      TEXT        NOT NULL DEFAULT '#f97316',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT        NOT NULL,
    notes       TEXT        NOT NULL DEFAULT '',
    category    TEXT        NOT NULL CHECK (category IN ('grocery','chore','errand','repair')),
    priority    TEXT        NOT NULL CHECK (priority IN ('urgent','high','normal')) DEFAULT 'normal',
    assignee_id UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    done        BOOLEAN     NOT NULL DEFAULT FALSE,
    done_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_category    ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_done        ON tasks(done);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id  UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    body       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id);
