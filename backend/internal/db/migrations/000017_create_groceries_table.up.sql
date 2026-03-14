CREATE TABLE IF NOT EXISTS groceries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    quantity TEXT,
    notes TEXT NOT NULL DEFAULT '',
    done BOOLEAN NOT NULL DEFAULT false,
    done_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    household_id UUID REFERENCES households(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES members(id) ON DELETE SET NULL
);

-- Indices for performance
CREATE INDEX idx_groceries_household_id ON groceries(household_id);
CREATE INDEX idx_groceries_done ON groceries(done);

-- Migrate data
INSERT INTO groceries (id, title, quantity, notes, done, done_at, created_at, updated_at, household_id, assignee_id)
SELECT id, title, quantity, notes, done, done_at, created_at, updated_at, household_id, assignee_id
FROM tasks
WHERE category = 'grocery';

-- Clean up tasks
DELETE FROM tasks WHERE category = 'grocery';

-- Update tasks check constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_category_check CHECK (category = ANY (ARRAY['chore'::text, 'errand'::text, 'repair'::text]));
