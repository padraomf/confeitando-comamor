const fs = require('fs');
let c = fs.readFileSync('components/admin-panel.tsx', 'utf8');

c = c.replace(/<Button key=\{next\}.*?<\/Button>/, 
  "<Button key={next} disabled={busy} onClick={async()=>{if(await action('admin/order','PATCH',{id:orderDetail.id,status:next,pickupCode},'Etapa atualizada.'))setOrderDetail(o=>o?{...o,status:next}:o)}}>{({'Em preparo':'Iniciar preparo','Pronto para entrega':'Marcar como pronto','Pronto para retirada':'Avisar que está pronto','Saiu para entrega':'Enviar para entrega','Entregue':'Confirmar entrega','Retirado':'Confirmar retirada'})[next]||next}</Button>");

fs.writeFileSync('components/admin-panel.tsx', c);
