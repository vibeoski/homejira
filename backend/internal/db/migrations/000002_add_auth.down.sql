DROP INDEX IF EXISTS idx_members_phone;
ALTER TABLE members
    DROP COLUMN IF EXISTS phone,
    DROP COLUMN IF EXISTS mpin_hash;
