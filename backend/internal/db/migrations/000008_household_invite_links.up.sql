-- Shareable invite links for households.
-- Any admin can generate a link; anyone with the link can join (after auth).
-- Links expire after 7 days.

CREATE TABLE IF NOT EXISTS household_invite_links (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    created_by   UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    token        TEXT        NOT NULL UNIQUE,
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_household_invite_links_token      ON household_invite_links(token);
CREATE INDEX IF NOT EXISTS idx_household_invite_links_household  ON household_invite_links(household_id);
