import { execSync } from 'child_process';
const sql = `
WITH UniqueProfiles AS (
  SELECT 
    MAX(user_id) as user_id, 
    json_extract(data,'$.phone') as phone, 
    MAX(data) as data, 
    MAX(notes) as notes, 
    MAX(updated_at) as updated_at
  FROM profiles
  GROUP BY json_extract(data,'$.phone')
)
SELECT 
  p.user_id,
  p.data,
  p.notes,
  p.updated_at,
  COUNT(o.id) as orders,
  COALESCE(SUM(CASE WHEN o.payment_status='Pago' THEN o.total ELSE 0 END),0) as spent,
  MAX(o.created_at) as last_order
FROM UniqueProfiles p
LEFT JOIN orders o ON json_extract(o.data,'$.profile.phone') = p.phone
GROUP BY p.phone
`;
const out = execSync(`npx wrangler d1 execute site-creator-d1 --remote --json --command="${sql.replace(/\n/g, ' ')}"`, { encoding: 'utf-8' });
console.log(out);
