import { execSync } from 'child_process';
const sql = `UPDATE whatsapp_bridge SET runner='', lease_until=0, state='disconnected' WHERE id='store'`;
const out = execSync(`npx wrangler d1 execute site-creator-d1 --remote --json --command="${sql}"`, { encoding: 'utf-8' });
console.log(out);
