-- Coin transaction ledger.
-- Every coin earn event is recorded here for history display.

CREATE TABLE IF NOT EXISTS coin_transactions (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id  UUID        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    amount     INT         NOT NULL,
    reason     TEXT        NOT NULL,
    meta       JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_member ON coin_transactions(member_id);
