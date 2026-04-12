-- ============================================================
-- GM06 — Group Chat & Voting System
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Group messages (club-wide chat)
CREATE TABLE group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_group_messages_created ON group_messages(created_at DESC);
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read group messages" ON group_messages FOR SELECT USING (true);

-- 2. Ballots (voting questions created by admin)
CREATE TABLE ballots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  options JSONB NOT NULL DEFAULT '[]',
  created_by UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  allow_multiple BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_ballots_status ON ballots(status, created_at DESC);
ALTER TABLE ballots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read ballots" ON ballots FOR SELECT USING (true);

-- 3. Ballot votes
CREATE TABLE ballot_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ballot_id UUID NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  choice TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ballot_id, member_id, choice)
);

CREATE INDEX idx_ballot_votes_ballot ON ballot_votes(ballot_id);
CREATE INDEX idx_ballot_votes_member ON ballot_votes(member_id);
ALTER TABLE ballot_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read ballot votes" ON ballot_votes FOR SELECT USING (true);

-- 4. Decisions (outcomes of closed ballots)
CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ballot_id UUID REFERENCES ballots(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  outcome TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  decided_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_decisions_decided ON decisions(decided_at DESC);
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read decisions" ON decisions FOR SELECT USING (true);
