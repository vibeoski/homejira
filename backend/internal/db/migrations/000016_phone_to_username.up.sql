-- Rename phone -> username for login credentials
ALTER TABLE members RENAME COLUMN phone TO username;

-- Drop old index
DROP INDEX IF EXISTS idx_members_phone;

-- Add length constraint (>= 3 chars)
ALTER TABLE members
    ADD CONSTRAINT members_username_min_length CHECK (char_length(username) >= 3);

-- New unique index
CREATE UNIQUE INDEX idx_members_username ON members(username) WHERE username IS NOT NULL;
