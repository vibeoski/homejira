-- Feature flags table — toggle features without a deploy
CREATE TABLE IF NOT EXISTS feature_flags (
  key        TEXT PRIMARY KEY,
  enabled    BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial flags (disabled by default)
INSERT INTO feature_flags (key, enabled) VALUES
  ('phone_verification', false),
  ('email_verification', false),
  ('referral_system',    false),
  ('coins',             false),
  ('grocery_list',      true),
  ('stats',             true)
ON CONFLICT (key) DO NOTHING;
