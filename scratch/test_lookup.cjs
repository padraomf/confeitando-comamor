const phone = '74999204407';

fetch('https://confeitando-com-amor.padraomf.workers.dev/api/customer/lookup-phone', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ phone })
})
.then(res => res.text())
.then(data => {
  console.log("RESPONSE:", data.slice(0, 500));
})
.catch(err => {
  console.error("ERROR:", err);
});
