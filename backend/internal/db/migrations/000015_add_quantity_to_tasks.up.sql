-- Add optional quantity field to tasks (grocery-only semantic)
-- Free-text field (e.g. "2 gallons", "1 dozen") — no unit enforcement at DB level.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS quantity TEXT;
