const { execSync } = require('child_process');
try {
  console.log("Recent Orders:", execSync('npx wrangler d1 execute site-creator-d1 --remote --command="SELECT id, user_id, status, payment_status, created_at, data FROM orders ORDER BY created_at DESC LIMIT 3"').toString());
} catch (e) {
  console.log(e.stdout ? e.stdout.toString() : e.toString());
}
