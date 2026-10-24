CREATE TABLE IF NOT EXISTS whatsapp_sale_drafts (
 phone TEXT PRIMARY KEY,
 request_id TEXT NOT NULL UNIQUE,
 data TEXT NOT NULL DEFAULT '{}',
 expected_total INTEGER,
 awaiting_confirmation INTEGER NOT NULL DEFAULT 0,
 order_id TEXT,
 updated_at INTEGER NOT NULL
);
