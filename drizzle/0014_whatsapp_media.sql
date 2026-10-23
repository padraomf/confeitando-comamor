CREATE TABLE IF NOT EXISTS whatsapp_media (
 id TEXT PRIMARY KEY,
 phone TEXT NOT NULL,
 message_id TEXT NOT NULL,
 kind TEXT NOT NULL,
 text TEXT NOT NULL,
 attachment_id TEXT,
 consumed INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 UNIQUE(phone,message_id)
);
CREATE INDEX IF NOT EXISTS whatsapp_media_pending ON whatsapp_media(phone,consumed,created_at);

CREATE TABLE IF NOT EXISTS whatsapp_login_codes (
 id TEXT PRIMARY KEY,
 phone TEXT NOT NULL,
 user_id TEXT NOT NULL,
 code_hash TEXT NOT NULL,
 expires INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS whatsapp_login_phone ON whatsapp_login_codes(phone);
