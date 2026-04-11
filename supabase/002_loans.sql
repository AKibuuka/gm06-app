-- ============================================================
-- GM06 — Loans System
-- Run this in Supabase SQL Editor after schema.sql
-- ============================================================

-- 1. Loans table
CREATE TABLE loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  interest_rate numeric(5,2) NOT NULL DEFAULT 10.00,
  total_due numeric(15,2) NOT NULL,
  amount_paid numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'active', 'paid', 'rejected')),
  reason text,
  notes text,
  approved_by_1 uuid REFERENCES members(id) CONSTRAINT fk_approved_by_1,
  approved_by_2 uuid REFERENCES members(id) CONSTRAINT fk_approved_by_2,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  activated_at timestamptz,
  paid_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- One active/pending loan per member at a time
CREATE UNIQUE INDEX idx_loans_one_active
  ON loans(member_id)
  WHERE status IN ('pending', 'approved', 'active');

CREATE INDEX idx_loans_member ON loans(member_id);
CREATE INDEX idx_loans_status ON loans(status);

-- 2. Loan payments audit trail
CREATE TABLE loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount numeric(15,2) NOT NULL,
  source text NOT NULL DEFAULT 'contribution'
    CHECK (source IN ('contribution', 'manual', 'other')),
  contribution_id uuid REFERENCES contributions(id),
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_loan_payments_loan ON loan_payments(loan_id);

-- RLS
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read loans" ON loans FOR SELECT USING (true);
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read loan_payments" ON loan_payments FOR SELECT USING (true);

-- 3. Loan settings
INSERT INTO settings (key, value) VALUES
  ('max_loan_pct', '80'),
  ('loan_interest_rate', '10')
ON CONFLICT (key) DO NOTHING;
