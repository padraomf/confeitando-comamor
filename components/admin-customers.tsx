'use client';
import { useState, useEffect } from 'react';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { api, errorMessage } from '@/lib/client';
import { money, addressText } from '@/lib/commerce';
import { ChevronDown, ChevronUp } from 'lucide-react';

function CustomerCard({ c, onUpdateNotes }: { c: any, onUpdateNotes: (id: string, notes: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="settings-card" style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '1rem' }}>
      <div 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0 }}>{c.data.name}</h3>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
            {c.data.phone} &middot; {c.orders} {c.orders === 1 ? 'pedido' : 'pedidos'}
          </p>
        </div>
        <Button variant="outline" size="icon" aria-label="Expandir">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
      </div>

      {expanded && (
        <div style={{ marginTop: '1.2rem', borderTop: '1px solid var(--border)', paddingTop: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {c.data.cpf && <p style={{ margin: 0 }}><strong>CPF:</strong> {c.data.cpf}</p>}
          {c.data.email && <p style={{ margin: 0 }}><strong>E-mail:</strong> {c.data.email}</p>}
          <p style={{ margin: 0 }}><strong>Total gasto:</strong> {money(c.spent)} em compras pagas</p>
          {c.data.address && <p style={{ margin: 0 }}><strong>Último Endereço:</strong> {addressText(c.data.address)}</p>}
          
          <label className="field" style={{ marginTop: '0.5rem' }}>
            <span>Observações internas</span>
            <Textarea 
              maxLength={2000} 
              value={c.notes || ''} 
              onChange={e => onUpdateNotes(c.user_id, e.target.value)} 
              placeholder="Ex: Cliente prefere bolo com menos açúcar..."
            />
          </label>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <Button onClick={async () => {
              try {
                await api('admin/customers', { method: 'PATCH', body: JSON.stringify({ id: c.user_id, notes: c.notes || '' }) });
                toast.success('Observação salva.');
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}>Salvar observação</Button>
            <Button variant="secondary" onClick={async () => {
              if (!confirm('Gerar uma nova senha para este cliente?')) return;
              try {
                const r = await api('admin/customers/reset-password', { method: 'POST', body: JSON.stringify({ id: c.user_id }) });
                prompt('Nova senha gerada com sucesso! Copie e envie para o cliente:', r.password);
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}>Gerar nova senha</Button>
          </div>
          
          <a className="text-link" style={{ marginTop: '0.5rem', display: 'inline-block' }} href={'/painel/historico?cliente=' + encodeURIComponent(c.data.name)}>
            Ver histórico de compras ↗
          </a>
        </div>
      )}
    </article>
  );
}

export default function AdminCustomers() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;
    setBusy(true);
    api('admin/customers?q=' + encodeURIComponent(filter)).then(r => {
      if (active) {
        setRows(r.customers);
        setError('');
      }
    }).catch(e => {
      if (active) setError(errorMessage(e));
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false };
  }, [filter]);

  const handleUpdateNotes = (id: string, notes: string) => {
    setRows(rs => rs.map(row => row.user_id === id ? { ...row, notes } : row));
  };

  return (
    <>
      <div className="section-toolbar">
        <div>
          <h2>Clientes</h2>
          <p>Contatos, endereços e compras, inclusive de convidados.</p>
        </div>
      </div>
      <form className="history-filters" onSubmit={e => { e.preventDefault(); setFilter(q) }}>
        <Input aria-label="Buscar cliente" placeholder="Nome ou telefone" value={q} onChange={e => setQ(e.target.value)} />
        <Button>Buscar</Button>
      </form>
      {error && <p role="alert">{error}</p>}
      
      {busy ? (
        <p>Consultando clientes…</p>
      ) : !rows.length ? (
        <div className="admin-empty">
          <h3>Nenhum cliente encontrado</h3>
          <p>Os clientes aparecem aqui depois do cadastro ou pedido.</p>
        </div>
      ) : (
        <div className="customer-grid">
          {rows.map(c => (
            <CustomerCard key={c.user_id} c={c} onUpdateNotes={handleUpdateNotes} />
          ))}
        </div>
      )}
    </>
  );
}
