-- ============================================================
-- GM06 — Security Fixes: Tighten RLS policies
-- Run this in Supabase SQL Editor
-- ============================================================

-- NOTE: This app uses a service_role key for all API queries,
-- so RLS acts as defense-in-depth, not primary access control.
-- The API layer enforces authorization. These policies restrict
-- direct database access (e.g. via Supabase client with anon key).

-- 1. Fix mfa_recovery_codes — only owner can read their codes
DROP POLICY IF EXISTS "Anyone can read recovery codes" ON mfa_recovery_codes;
CREATE POLICY "Members read own recovery codes" ON mfa_recovery_codes
  FOR SELECT USING (member_id = auth.uid());

-- 2. Fix messages — only sender/recipient can read
DROP POLICY IF EXISTS "Anyone can read messages" ON messages;
CREATE POLICY "Members read own messages" ON messages
  FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- 3. Fix contributions — members see only their own
DROP POLICY IF EXISTS "Members see own contributions" ON contributions;
CREATE POLICY "Members see own contributions" ON contributions
  FOR SELECT USING (member_id = auth.uid());

-- 4. Fix member_snapshots — members see only their own
DROP POLICY IF EXISTS "Members see own snapshots" ON member_snapshots;
CREATE POLICY "Members see own snapshots" ON member_snapshots
  FOR SELECT USING (member_id = auth.uid());

-- 5. Fix loans — members see only their own
DROP POLICY IF EXISTS "Anyone can read loans" ON loans;
CREATE POLICY "Members read own loans" ON loans
  FOR SELECT USING (member_id = auth.uid());

-- 6. Fix loan_payments — members see only their own
DROP POLICY IF EXISTS "Anyone can read loan_payments" ON loan_payments;
CREATE POLICY "Members read own loan payments" ON loan_payments
  FOR SELECT USING (member_id = auth.uid());

-- 7. Fix withdrawal_requests — members see only their own
DROP POLICY IF EXISTS "Anyone can read withdrawal_requests" ON withdrawal_requests;
CREATE POLICY "Members read own withdrawals" ON withdrawal_requests
  FOR SELECT USING (member_id = auth.uid());

-- 8. Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_loan_payments_member ON loan_payments(member_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_fines_member_paid ON fines(member_id, is_paid);
CREATE INDEX IF NOT EXISTS idx_contributions_member_date ON contributions(member_id, date DESC);
