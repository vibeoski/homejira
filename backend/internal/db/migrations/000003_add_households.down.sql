-- Roll back households / groups schema

-- Drop invites and join requests first due to FK dependencies
DROP TABLE IF EXISTS household_invites;
DROP TABLE IF EXISTS household_join_requests;

-- Drop member->household relationship and role
ALTER TABLE members DROP CONSTRAINT IF EXISTS fk_members_household;

ALTER TABLE members
    DROP COLUMN IF EXISTS household_id,
    DROP COLUMN IF EXISTS role;

-- Finally drop households table
DROP TABLE IF EXISTS households;

