import { execSync } from 'child_process';
const out = execSync(`npx wrangler d1 execute site-creator-d1 --remote --json --command="SELECT * FROM whatsapp_outbox ORDER BY created_at DESC LIMIT 5"`, { encoding: 'utf-8' });
console.log(out);
