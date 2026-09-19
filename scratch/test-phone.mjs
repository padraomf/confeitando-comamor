fetch('https://padraomf.workers.dev/customer/lookup-phone', {
  method: 'POST',
  body: JSON.stringify({ phone: '74999204407' })
}).then(async r => {
  const text = await r.text();
  try {
    console.log(JSON.parse(text));
  } catch(e) {
    console.log("Not JSON:", text.substring(0, 100));
  }
}).catch(console.error);
