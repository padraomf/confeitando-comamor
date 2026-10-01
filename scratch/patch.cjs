const fs = require('fs');
let text = fs.readFileSync('components/admin-panel.tsx', 'utf8');

text = text.replace(
  /<div><strong>\{o\.data\.profile\.name\}<\/strong><small>\{o\.data\.items\.map\(i=>`\$\{i\.quantity\}× \$\{i\.name\}`\)\.join\(\', \'\)\}<\/small><\/div>/g,
  `<div><strong>{o.data.profile.name}</strong><small>{o.data.items.map(i=>\`\${i.quantity}× \${i.name}\`).join(', ')}</small></div><div style={{color:'var(--muted)',fontSize:'0.85rem'}}>{o.data.dueDate && !ended.includes(o.status) ? (o.data.dueDate.includes('T') ? 'Para: '+new Date(o.data.dueDate).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : 'Para: '+o.data.dueDate.split('-').reverse().join('/')) : ''}{['Entregue', 'Retirado', 'Concluído'].includes(o.status) && (o.data as any).deliveredAt ? 'Entregue: '+new Date((o.data as any).deliveredAt).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit'}) : ''}</div>`
);

// Add edit date capability
text = text.replace(
  /\{orderDetail\.data\.dueDate\?\' · Encomenda: \'\+orderDetail\.data\.dueDate\.split\(\'-\'\)\.reverse\(\)\.join\(\'\/\'\):\'\'\}/g,
  `{orderDetail.data.dueDate ? ' · Para: ' + (orderDetail.data.dueDate.includes('T') ? new Date(orderDetail.data.dueDate).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : orderDetail.data.dueDate.split('-').reverse().join('/')) : ''}`
);

// We need an input to edit the dueDate in the order details dialog
text = text.replace(
  /\{orderDetail\.data\.note&&<p><strong>Observação:<\/strong> \{orderDetail\.data\.note\}<\/p>\}/g,
  `{orderDetail.data.note&&<p><strong>Observação:</strong> {orderDetail.data.note}</p>}
  {orderDetail.data.dueDate && session.role === 'admin' && (
      <label className="field" style={{marginTop:'12px'}}>
         <span>Editar data/hora da encomenda</span>
         <div style={{display:'flex',gap:'8px'}}>
             <Input type={orderDetail.data.dueDate.includes('T')?'datetime-local':'date'} value={orderDetail.data.dueDate} onChange={async (e) => {
                 const newVal = e.target.value;
                 if (await action('admin/order-date', 'PATCH', {id: orderDetail.id, dueDate: newVal}, 'Data atualizada.')) {
                     setOrderDetail({...orderDetail, data: {...orderDetail.data, dueDate: newVal}});
                 }
             }} />
         </div>
      </label>
  )}`
);

fs.writeFileSync('components/admin-panel.tsx', text);
