-- Households / groups and membership metadata

-- Core households table
CREATE TABLE IF NOT EXISTS households (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    kind        TEXT        NOT NULL CHECK (kind IN ('home', 'group')),
    join_code   TEXT        NOT NULL UNIQUE,
    created_by  UUID        NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_households_join_code ON households(join_code);

-- Members: link to a household and track simple role
ALTER TABLE members
    ADD COLUMN IF NOT EXISTS household_id UUID NULL,
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('admin', 'member'));

ALTER TABLE members
    ADD CONSTRAINT fk_members_household
        FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_members_household_id ON members(household_id);

-- Join requests: when a member requests to join via a join_code
CREATE TABLE IF NOT EXISTS household_join_requests (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    requester_id UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    status       TEXT        NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at   TIMESTAMPTZ,
    decided_by   UUID REFERENCES members(id),
    note         TEXT
);

CREATE INDEX IF NOT EXISTS idx_join_requests_household_id ON household_join_requests(household_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_requester_id ON household_join_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON household_join_requests(status);

-- Invites: admin invites someone (by phone/name) to join
CREATE TABLE IF NOT EXISTS household_invites (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id  UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    invited_phone TEXT,
    invited_name  TEXT,
    status        TEXT        NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    created_by    UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_household_id ON household_invites(household_id);
CREATE INDEX IF NOT EXISTS idx_invites_invited_phone ON household_invites(invited_phone);
CREATE INDEX IF NOT EXISTS idx_invites_status ON household_invites(status);

