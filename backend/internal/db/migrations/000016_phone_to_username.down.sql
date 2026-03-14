DROP INDEX IF EXISTS idx_members_username;
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_username_min_length;
ALTER TABLE members RENAME COLUMN username TO phone;
CREATE UNIQUE INDEX idx_members_phone ON members(phone) WHERE phone IS NOT NULL;
