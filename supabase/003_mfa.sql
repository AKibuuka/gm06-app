-- ============================================================
-- GM06 — Multi-Factor Authentication
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE members ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS mfa_secret TEXT;

CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mfa_recovery_member ON mfa_recovery_codes(member_id);

ALTER TABLE mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read recovery codes" ON mfa_recovery_codes FOR SELECT USING (true);
