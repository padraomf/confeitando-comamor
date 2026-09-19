const { execSync } = require('child_process');
try {
  const output = execSync('npx wrangler d1 execute site-creator-d1 --remote --command="SELECT id, email, name FROM customers WHERE email = \'maciel.felix10@hotmail.com\'"');
  console.log("CUSTOMERS:", output.toString());
} catch (e) {
  console.log(e.stdout ? e.stdout.toString() : e.toString());
}
