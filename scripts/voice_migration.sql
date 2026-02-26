-- ============================================================
-- Phase 2: Voice Teacher — Supabase Migration Script
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Conversation Sessions
CREATE TABLE IF NOT EXISTS conversation_sessions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL,
    subject_id  UUID NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Conversation Messages
CREATE TABLE IF NOT EXISTS conversation_messages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id  UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    message     TEXT NOT NULL,
    timestamp   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conv_messages_session ON conversation_messages(session_id, timestamp);

-- 3. Voice Performance Metrics
CREATE TABLE IF NOT EXISTS voice_performance_metrics (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id     UUID REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    question       TEXT,
    student_answer TEXT,
    evaluation     TEXT,
    correct        BOOLEAN,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_voice_perf_session ON voice_performance_metrics(session_id);

-- ============================================================
-- If you already have the tables, just add missing columns:
-- ============================================================
-- ALTER TABLE conversation_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
