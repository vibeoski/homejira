-- Add phone number and mPIN hash to members for authentication
ALTER TABLE members
    ADD COLUMN phone      TEXT UNIQUE,
    ADD COLUMN mpin_hash  TEXT;

CREATE UNIQUE INDEX idx_members_phone ON members(phone) WHERE phone IS NOT NULL;
