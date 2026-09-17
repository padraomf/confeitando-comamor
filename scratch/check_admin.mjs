fetch('http://localhost:5173/api/admin/data', { headers: { authorization: 'Bearer admin' } }).then(r=>r.json()).then(console.log)
