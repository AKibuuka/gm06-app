-- ============================================================
-- GM06 — Messaging, Announcements & Contribution Notifications
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Announcements (admin → all members)
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_announcements_created ON announcements(created_at DESC);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read announcements" ON announcements FOR SELECT USING (true);

-- 2. Messages (member ↔ member direct messages)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_recipient ON messages(recipient_id, is_read);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_conversation ON messages(
  LEAST(sender_id, recipient_id),
  GREATEST(sender_id, recipient_id),
  created_at DESC
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read messages" ON messages FOR SELECT USING (true);

-- 3. Club-wide required contribution amount
INSERT INTO settings (key, value) VALUES
  ('required_contribution', '200000')
ON CONFLICT (key) DO NOTHING;
