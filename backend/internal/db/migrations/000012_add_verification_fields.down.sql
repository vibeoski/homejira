DROP TABLE IF EXISTS email_verifications;
ALTER TABLE members DROP COLUMN IF EXISTS phone_verified;
ALTER TABLE members DROP COLUMN IF EXISTS email_verified;
ALTER TABLE members DROP COLUMN IF EXISTS email;
