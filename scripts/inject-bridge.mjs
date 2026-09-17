import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';

const db = new DatabaseSync('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite');
const token = crypto.randomBytes(32).toString('hex');
const hash = crypto.createHash('sha256').update(token).digest('hex');

db.exec(`INSERT INTO whatsapp_bridge(id, token_hash) VALUES('store', '${hash}') ON CONFLICT(id) DO UPDATE SET token_hash=excluded.token_hash, desired='disconnected', state='offline', qr='', phone='', last_seen=0;`);

fs.mkdirSync('whatsapp-bridge/data', {recursive: true});
fs.writeFileSync('whatsapp-bridge/data/config.json', JSON.stringify({site: 'http://localhost:3000', token}));
console.log("Bridge configured");
