import { execSync } from 'child_process';
const sql = `UPDATE whatsapp_outbox SET status='skipped', detail='Cancelado emergencialmente' WHERE status IN ('queued', 'processing')`;
const out = execSync(`npx wrangler d1 execute site-creator-d1 --remote --json --command="${sql}"`, { encoding: 'utf-8' });
console.log(out);
