const db = require('better-sqlite3')('confeitando.db');
console.log("Settings:", db.prepare('SELECT * FROM settings').all());
console.log("Outbox:", db.prepare('SELECT id, phone, type, created_at FROM whatsapp_outbox WHERE phone LIKE "%74998184690%"').all());
console.log("Orders:", db.prepare('SELECT id, user_id FROM orders WHERE data LIKE "%74998184690%"').all());
console.log("Profiles:", db.prepare('SELECT user_id, data FROM profiles WHERE data LIKE "%74998184690%"').all());
