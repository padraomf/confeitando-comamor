fetch('https://confeitando-comamor.pages.dev/api/customer/lookup-phone', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ phone: '74999204407' })
}).then(r => r.json()).then(console.log).catch(console.error);
