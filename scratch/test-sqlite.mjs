import Database from 'better-sqlite3';
const db = new Database(':memory:');
db.exec('CREATE TABLE profiles (data TEXT)');
db.exec(`INSERT INTO profiles (data) VALUES ('{"phone":"(74) 99920-4407"}')`);
db.exec(`INSERT INTO profiles (data) VALUES ('{"phone":"74999204407"}')`);

const cleanPhoneSQL = `REPLACE(REPLACE(REPLACE(REPLACE(json_extract(data,'$.phone'), ' ', ''), '-', ''), '(', ''), ')', '')`;

const r = db.prepare(`SELECT data FROM profiles WHERE ${cleanPhoneSQL}=?`).all('74999204407');
console.log("Matched rows:", r.length);
r.forEach(row => console.log(row.data));
