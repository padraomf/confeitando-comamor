import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite');

db.exec(`UPDATE whatsapp_bridge SET last_seen = 0, runner = NULL;`);
console.log("Bridge lock cleared.");
