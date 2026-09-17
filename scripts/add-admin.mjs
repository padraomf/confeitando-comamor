import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

const db = new DatabaseSync('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite');

const derive = (password, salt) => new Promise((resolve, reject) => crypto.scrypt(password, salt, 32, { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));

async function run() {
  const salt = crypto.randomBytes(32).toString('hex');
  const derived = await derive('admin', salt);
  const hash = `scrypt:16384:8:5:${salt}:${derived.toString('hex')}`;

  db.exec(`INSERT INTO admin_accounts(id,name,login,password_hash,created_at,role,active) VALUES('test-admin','Teste','teste','${hash}',${Date.now()},'admin',1) ON CONFLICT(login) DO UPDATE SET password_hash=excluded.password_hash;`);
  console.log("Admin added.");
}
run();
