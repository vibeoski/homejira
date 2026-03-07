-- Add coin balance to members table.
-- Coins are earned by inviting household members (20 coins) and app referrals (10 coins).

ALTER TABLE members ADD COLUMN IF NOT EXISTS coins INT NOT NULL DEFAULT 0;
