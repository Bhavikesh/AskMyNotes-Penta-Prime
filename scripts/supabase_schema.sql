-- ============================================================
-- AskMyNotes Supabase Schema
-- Run this in the Supabase SQL Editor to set up all tables.
-- ============================================================

-- ── Users ────────────────────────────────────────────────────
-- Lightweight user record.  No auth — user_id is generated
-- by the frontend (UUID v4) and passed in every request.
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Subjects ─────────────────────────────────────────────────
-- Max 3 per user is enforced at the application layer.
CREATE TABLE IF NOT EXISTS subjects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, name)
);

-- ── Documents ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    file_name   TEXT NOT NULL,
    upload_time TIMESTAMPTZ DEFAULT now()
);

-- ── Chunk Metadata ───────────────────────────────────────────
-- Mirrors what lives in the in-memory FAISS index.
-- embedding_id is the FAISS flat-index position (integer).
CREATE TABLE IF NOT EXISTS chunks_metadata (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id   UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id     INTEGER NOT NULL,
    page_number  INTEGER,
    file_name    TEXT,
    text         TEXT NOT NULL,
    embedding_id INTEGER   -- position in FAISS index
);

-- ── Queries (history) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    answer      TEXT,
    confidence  TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Performance Metrics ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS performance_metrics (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id    UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    question_id   UUID REFERENCES queries(id) ON DELETE SET NULL,
    correct       BOOLEAN,
    response_time FLOAT,
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Study Sessions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS study_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id      UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    score           INTEGER,
    total_questions INTEGER,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes for fast per-user lookups ────────────────────────
CREATE INDEX IF NOT EXISTS idx_subjects_user_id         ON subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_subject   ON documents(user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_chunks_user_subject      ON chunks_metadata(user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_queries_user_subject     ON queries(user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_metrics_user_subject     ON performance_metrics(user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_subject    ON study_sessions(user_id, subject_id);
