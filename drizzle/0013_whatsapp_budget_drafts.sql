CREATE TABLE IF NOT EXISTS whatsapp_budget_drafts (
 phone TEXT PRIMARY KEY NOT NULL,
 request_id TEXT NOT NULL UNIQUE,
 draft TEXT NOT NULL DEFAULT '{}',
 awaiting_confirmation INTEGER NOT NULL DEFAULT 0,
 budget_id TEXT,
 updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
 phone TEXT PRIMARY KEY NOT NULL,
 name TEXT,
 stage TEXT NOT NULL DEFAULT 'ask_name',
 user_id TEXT,
 updated_at INTEGER NOT NULL DEFAULT 0
);
