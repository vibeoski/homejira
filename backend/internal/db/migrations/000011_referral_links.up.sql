-- App referral links — one permanent link per member.
-- When someone signs up via this link, the link owner earns 10 coins.

CREATE TABLE IF NOT EXISTS referral_links (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id  UUID        NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
    token      TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_links_token  ON referral_links(token);
CREATE INDEX IF NOT EXISTS idx_referral_links_member ON referral_links(member_id);
