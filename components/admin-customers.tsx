'use client';
import { useState, useEffect } from 'react';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { api, errorMessage } from '@/lib/client';
import { money, addressText, emptyAddress, type Address } from '@/lib/commerce';
import { ChevronDown, ChevronUp, Edit2, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { AddressFields } from './address-fields';

function CustomerCard({ c, onUpdateNotes, onEdit }: { c: any, onUpdateNotes: (id: string, notes: string) => void, onEdit: (c: any) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="settings-card" style={{ padding: '0.85rem', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '0.85rem' }}>
      <div 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.data.name}</h3>
          <p style={{ margin: '0.15rem 0 0', color: 'var(--muted)', fontSize: '0.8rem' }}>
            {c.data.phone} &middot; {c.orders} {c.orders === 1 ? 'pedido' : 'pedidos'}
          </p>
        </div>
        <Button variant="outline" size="icon" aria-label="Expandir">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
      </div>

      {expanded && (
        <div style={{ marginTop: '0.85rem', borderTop: '1px solid var(--border)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem' }}>
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
            <Button onClick={() => onEdit(c)} variant="outline" size="sm" style={{flexBasis: '100%'}}>
              <Edit2 size={15} style={{marginRight: '6px'}} /> Editar cliente
            </Button>
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
  const [editing, setEditing] = useState<any | null>(null);

  const load = (f = filter) => {
    setBusy(true);
    api('admin/customers?q=' + encodeURIComponent(f)).then(r => {
      setRows(r.customers);
      setError('');
    }).catch(e => {
      setError(errorMessage(e));
    }).finally(() => {
      setBusy(false);
    });
  };

  useEffect(() => {
    load();
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
        <Button onClick={() => setEditing({ user_id: '', data: { name: '', phone: '', email: '', cpf: '', address: emptyAddress }, notes: '' })}>
          <Plus size={16} style={{marginRight: '6px'}} /> Novo cliente
        </Button>
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
        <div className="customer-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0 1rem' }}>
          {rows.map(c => (
            <CustomerCard key={c.user_id} c={c} onUpdateNotes={handleUpdateNotes} onEdit={c => setEditing(JSON.parse(JSON.stringify(c)))} />
          ))}
        </div>
      )}
      
      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="address-dialog" style={{ maxWidth: '600px' }}>
          <DialogHeader>
            <DialogTitle>{editing?.user_id ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form className="form-stack" onSubmit={async e => {
              e.preventDefault();
              try {
                if (editing.user_id) {
                  await api('admin/customers', { method: 'PUT', body: JSON.stringify({ id: editing.user_id, ...editing.data, notes: editing.notes }) });
                  toast.success('Cliente atualizado!');
                } else {
                  await api('admin/customers', { method: 'POST', body: JSON.stringify({ ...editing.data, notes: editing.notes }) });
                  toast.success('Cliente criado!');
                }
                setEditing(null);
                load();
              } catch (err) {
                toast.error(errorMessage(err));
              }
            }}>
              <label className="field">
                <span>Nome completo</span>
                <Input required value={editing.data.name} onChange={e => setEditing({ ...editing, data: { ...editing.data, name: e.target.value } })} />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>Celular / WhatsApp</span>
                  <Input type="tel" required placeholder="5511999999999" value={editing.data.phone} onChange={e => setEditing({ ...editing, data: { ...editing.data, phone: e.target.value } })} />
                </label>
                <label className="field">
                  <span>CPF</span>
                  <Input value={editing.data.cpf} onChange={e => setEditing({ ...editing, data: { ...editing.data, cpf: e.target.value } })} />
                </label>
              </div>
              <label className="field">
                <span>E-mail</span>
                <Input type="email" value={editing.data.email} onChange={e => setEditing({ ...editing, data: { ...editing.data, email: e.target.value } })} />
              </label>
              
              <div style={{ marginTop: '0.5rem' }}>
                <span style={{ fontSize: '14px', color: '#634b40', marginBottom: '8px', display: 'block' }}>Endereço padrão</span>
                <AddressFields value={editing.data.address || emptyAddress} onChange={a => setEditing({ ...editing, data: { ...editing.data, address: a } })} />
              </div>

              <label className="field" style={{ marginTop: '0.5rem' }}>
                <span>Observações internas</span>
                <Textarea value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} />
              </label>

              <Button style={{ marginTop: '1rem' }} className="primary-action">
                Salvar cliente
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
