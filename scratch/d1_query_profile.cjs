const { execSync } = require('child_process');
try {
  const output = execSync('npx wrangler d1 execute site-creator-d1 --remote --command="SELECT data FROM profiles WHERE user_id = \'customer_e1cb195c-0b62-4358-a6a4-3fbc2f54f2a7\'"');
  console.log("PROFILES:", output.toString());
} catch (e) {
  console.log(e.stdout ? e.stdout.toString() : e.toString());
}
