-- ============================================================
-- GM06 — Meeting Notes
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_meeting_notes_date ON meeting_notes(meeting_date DESC);
ALTER TABLE meeting_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read meeting notes" ON meeting_notes FOR SELECT USING (true);
