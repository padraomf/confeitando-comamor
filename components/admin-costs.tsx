'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';
import { Plus, Pencil, Trash2, Check, LoaderCircle, Download, FileSpreadsheet, FileText, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/client';
import { money } from '@/lib/commerce';
import { toast } from 'sonner';

type Cost = {
  id: string;
  description: string;
  purchase_date: string;
  amount: number;
  due_date: string;
  paid: number;
  paid_at: number | null;
  created_at: number;
};

const months = [
  { value: '0', label: 'Todos os meses' },
  { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' }, { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
];

const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

export default function AdminCosts() {
  const [costs, setCosts] = useState<Cost[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(String(currentDate.getMonth() + 1));
  const [year, setYear] = useState(String(currentYear));
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<Cost | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const sequence = useRef(0);

  const [form, setForm] = useState({
    description: '',
    purchaseDate: '',
    amount: '',
    dueDate: '',
  });

  useEffect(() => {
    const n = ++sequence.current;
    setLoading(true);
    api('admin/costs?' + new URLSearchParams({ month, year, status: statusFilter }))
      .then(r => { if (n === sequence.current) setCosts(r.costs); })
      .catch(e => { if (n === sequence.current) toast.error(errorMessage(e)); })
      .finally(() => { if (n === sequence.current) setLoading(false); });
    return () => { sequence.current++; };
  }, [month, year, statusFilter, refresh]);

  const unpaid = costs.filter(c => !c.paid);
  const paid = costs.filter(c => !!c.paid);
  const sorted = [...unpaid, ...paid];

  const totalAll = costs.reduce((s, c) => s + c.amount, 0);
  const totalPaid = paid.reduce((s, c) => s + c.amount, 0);
  const totalUnpaid = unpaid.reduce((s, c) => s + c.amount, 0);

  function openEditor(cost?: Cost) {
    setEditing(cost ?? { new: true });
    setForm(cost ? {
      description: cost.description,
      purchaseDate: cost.purchase_date,
      amount: (cost.amount / 100).toFixed(2).replace('.', ','),
      dueDate: cost.due_date,
    } : { description: '', purchaseDate: new Date().toISOString().slice(0, 10), amount: '', dueDate: '' });
  }

  async function saveCost() {
    const amount = Math.round(Number(form.amount.replace(',', '.')) * 100);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Informe um valor válido.'); return; }
    if (!form.description.trim()) { toast.error('Informe uma descrição.'); return; }
    if (!form.purchaseDate) { toast.error('Informe a data da compra.'); return; }
    if (!form.dueDate) { toast.error('Informe a data de vencimento.'); return; }
    setBusy(true);
    try {
      await api('admin/costs', {
        method: 'POST',
        body: JSON.stringify({
          ...(editing.id ? { id: editing.id } : {}),
          description: form.description.trim(),
          purchaseDate: form.purchaseDate,
          amount,
          dueDate: form.dueDate,
        })
      });
      toast.success(editing.id ? 'Custo atualizado.' : 'Custo adicionado.');
      setEditing(null);
      setRefresh(v => v + 1);
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  }

  async function togglePaid(cost: Cost) {
    setBusy(true);
    try {
      await api('admin/costs', {
        method: 'PATCH',
        body: JSON.stringify({ id: cost.id, paid: !cost.paid })
      });
      toast.success(cost.paid ? 'Custo desmarcado como pago.' : 'Custo marcado como pago!');
      setRefresh(v => v + 1);
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  }

  async function deleteCost() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api('admin/costs', {
        method: 'DELETE',
        body: JSON.stringify({ id: deleting.id })
      });
      toast.success('Custo excluído.');
      setDeleting(null);
      setRefresh(v => v + 1);
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  }

  function exportUrl(format: 'pdf' | 'csv', scope: string) {
    return '/api/admin/costs/export?' + new URLSearchParams({
      month, year, status: statusFilter, format, scope
    });
  }

  function formatDate(d: string) {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  function isOverdue(cost: Cost) {
    if (cost.paid) return false;
    return new Date(cost.due_date + 'T23:59:59') < new Date();
  }

  return <>
    <div className="section-toolbar">
      <div>
        <h2>Custos da confeitaria</h2>
        <p>Controle de gastos, vencimentos e pagamentos.</p>
      </div>
      <div className="toolbar-actions">
        <Button onClick={() => openEditor()}>
          <Plus size={18} />Adicionar custo
        </Button>
        <Button variant="outline" onClick={() => setExportOpen(true)}>
          <Download size={17} />Exportar
        </Button>
      </div>
    </div>

    <div className="costs-filters">
      <Select value={month} onValueChange={setMonth}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={year} onValueChange={setYear}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="Todos">Todos</SelectItem>
          <SelectItem value="Pago">Pago</SelectItem>
          <SelectItem value="Não pago">Não pago</SelectItem>
        </SelectContent>
      </Select>
      <span className="costs-count">{costs.length} {costs.length === 1 ? 'custo' : 'custos'}</span>
    </div>

    <div className="metric-grid">
      <div className="metric">
        <span>Total de custos<DollarSign size={19} /></span>
        <strong>{money(totalAll)}</strong>
        <small>Período selecionado</small>
      </div>
      <div className="metric">
        <span>Total pago<CheckCircle2 size={19} /></span>
        <strong>{money(totalPaid)}</strong>
        <small>Já quitados</small>
      </div>
      <div className="metric">
        <span>Falta pagar<AlertCircle size={19} /></span>
        <strong>{money(totalUnpaid)}</strong>
        <small>{unpaid.length} {unpaid.length === 1 ? 'pendente' : 'pendentes'}</small>
      </div>
    </div>

    {loading ? <p role="status">Consultando custos…</p> : sorted.length ? <div className="costs-list">
      {sorted.map(c => (
        <div className={'cost-card' + (c.paid ? ' cost-paid' : '') + (isOverdue(c) ? ' cost-overdue' : '')} key={c.id}>
          <div className="cost-main">
            <div className="cost-info">
              <strong>{c.description}</strong>
              <div className="cost-meta">
                <span>Compra: {formatDate(c.purchase_date)}</span>
                <span>Vencimento: {formatDate(c.due_date)}</span>
              </div>
            </div>
            <div className="cost-amount">
              <strong>{money(c.amount)}</strong>
              <span className={'cost-status-pill ' + (c.paid ? 'paid' : 'unpaid')}>
                {c.paid ? 'Pago' : 'Não pago'}
              </span>
              {isOverdue(c) && <span className="cost-overdue-tag">Vencido</span>}
            </div>
          </div>
          <div className="cost-actions">
            <Button variant={c.paid ? 'outline' : 'default'} size="sm" disabled={busy} onClick={() => togglePaid(c)}>
              <Check size={15} />{c.paid ? 'Desmarcar' : 'Marcar como pago'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => openEditor(c)}>
              <Pencil size={15} />Editar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(c)}>
              <Trash2 size={15} />
            </Button>
          </div>
        </div>
      ))}
    </div> : <div className="admin-empty">
      <DollarSign size={40} />
      <h3>Nenhum custo registrado neste período.</h3>
      <p>Adicione seus custos para controlar os gastos da confeitaria.</p>
      <Button onClick={() => openEditor()}><Plus />Adicionar custo</Button>
    </div>}

    {/* Cost editor dialog */}
    <Dialog open={!!editing} onOpenChange={v => { if (!v) setEditing(null); }}>
      <DialogContent className="cost-edit-dialog">
        <DialogHeader>
          <div className="eyebrow">CONTROLE DE GASTOS</div>
          <DialogTitle>{editing?.new ? 'Adicionar custo' : 'Editar custo'}</DialogTitle>
          <DialogDescription>Registre os custos da confeitaria para manter o controle financeiro.</DialogDescription>
        </DialogHeader>
        <div className="form-stack">
          <label className="field">
            <span>Descrição</span>
            <Input value={form.description} maxLength={200} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex.: Farinha de trigo 5kg" />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Valor (R$)</span>
              <Input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" />
            </label>
            <label className="field">
              <span>Data da compra</span>
              <Input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
            </label>
          </div>
          <label className="field">
            <span>Vencimento</span>
            <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
          </label>
        </div>
        <Button className="primary-action" disabled={busy} onClick={saveCost}>
          {busy ? <LoaderCircle className="spin" /> : <Check size={17} />}
          {editing?.new ? 'Adicionar custo' : 'Salvar alterações'}
        </Button>
      </DialogContent>
    </Dialog>

    {/* Delete confirmation */}
    <AlertDialog open={!!deleting} onOpenChange={v => { if (!v) setDeleting(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir "{deleting?.description}"?</AlertDialogTitle>
          <AlertDialogDescription>O custo será removido permanentemente do sistema.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Manter custo</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={deleteCost}>Excluir custo</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Export dialog */}
    <Dialog open={exportOpen} onOpenChange={setExportOpen}>
      <DialogContent className="cost-export-dialog">
        <DialogHeader>
          <div className="eyebrow">EXPORTAÇÃO DE CUSTOS</div>
          <DialogTitle>Exportar custos</DialogTitle>
          <DialogDescription>Escolha o formato e o que deseja exportar.</DialogDescription>
        </DialogHeader>
        <div className="export-options">
          <div className="export-group">
            <h4><FileSpreadsheet size={18} />Excel (CSV)</h4>
            <a className="export-link" href={exportUrl('csv', 'filtered')} download>
              <Download size={15} />Exportar resultado filtrado
            </a>
            <a className="export-link" href={exportUrl('csv', 'all')} download>
              <Download size={15} />Exportar todos os custos
            </a>
            <a className="export-link" href={exportUrl('csv', 'unpaid')} download>
              <Download size={15} />Somente o que falta pagar
            </a>
            <a className="export-link" href={exportUrl('csv', 'paid')} download>
              <Download size={15} />Somente custos pagos
            </a>
          </div>
          <div className="export-group">
            <h4><FileText size={18} />PDF</h4>
            <a className="export-link" href={exportUrl('pdf', 'filtered')} target="_blank">
              <Download size={15} />Exportar resultado filtrado
            </a>
            <a className="export-link" href={exportUrl('pdf', 'all')} target="_blank">
              <Download size={15} />Exportar todos os custos
            </a>
            <a className="export-link" href={exportUrl('pdf', 'unpaid')} target="_blank">
              <Download size={15} />Somente o que falta pagar
            </a>
            <a className="export-link" href={exportUrl('pdf', 'paid')} target="_blank">
              <Download size={15} />Somente custos pagos
            </a>
          </div>
        </div>
        <p className="small-muted">
          O filtro atual é: {months.find(m => m.value === month)?.label || 'Todos'} de {year}, status: {statusFilter}.
        </p>
      </DialogContent>
    </Dialog>
  </>;
}
