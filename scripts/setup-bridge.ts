import { db } from '../lib/server';
import { token, digest } from '../lib/customer-auth';
import fs from 'fs';
import path from 'path';

async function run() {
    const credential = token();
    const hash = await digest(credential);
    await db().prepare("INSERT INTO whatsapp_bridge(id,token_hash) VALUES('store',?) ON CONFLICT(id) DO UPDATE SET token_hash=excluded.token_hash,desired='disconnected',revision=revision+1,state='offline',qr='',phone='',last_seen=0,runner='',lease_until=0").bind(hash).run();
    const configPath = path.join(process.cwd(), 'whatsapp-bridge', 'data');
    if (!fs.existsSync(configPath)) fs.mkdirSync(configPath, {recursive: true});
    fs.writeFileSync(path.join(configPath, 'config.json'), JSON.stringify({
        site: 'http://localhost:3000',
        token: credential
    }));
    console.log("Bridge setup successfully!");
    process.exit(0);
}
run();
