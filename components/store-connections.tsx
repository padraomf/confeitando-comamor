'use client';
import { useState } from 'react';
import {
  Wallet,
  Check,
  LoaderCircle,
  Copy,
  Bot,
  Sparkles,
  Send,
  Smartphone,
  Network,
  FileText,
  UserCheck,
  BellRing,
  HelpCircle,
  Play,
  RotateCcw,
} from 'lucide-react';
import { WhatsAppWebJS } from './whatsapp-webjs';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import type { StoreSettings } from '@/lib/commerce';
import { Field } from './store-settings';
import { api, errorMessage } from '@/lib/client';
import { toast } from 'sonner';

export function StoreConnections({
  settings,
  onChange,
  onSaveSettings,
  connections,
  onSaved,
}: {
  settings: StoreSettings;
  onChange: (s: StoreSettings) => void;
  onSaveSettings: () => Promise<void>;
  whatsapp: string;
  connections: any;
  onSaved: () => Promise<void>;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [testingTag, setTestingTag] = useState(false);

  // OpenAI testing state
  const [testMessage, setTestMessage] = useState('Olá! Quanto custa o bolo de morango e como faço para pedir?');
  const [testReply, setTestReply] = useState<string | null>(null);
  const [testingAI, setTestingAI] = useState(false);

  // Graphify report state
  const [graphReport, setGraphReport] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [showReport, setShowReport] = useState(false);

  // Notify phones state
  const adminPhones: string[] = settings.adminNotifyPhones?.length
    ? settings.adminNotifyPhones
    : ['5574988218637', '5574988546993'];
  const [newPhoneInput, setNewPhoneInput] = useState('');

  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  const field = (key: string, label: string, password = true) => (
    <Field
      key={key}
      label={label}
      type={password ? 'password' : 'text'}
      value={inputs[key] !== undefined ? inputs[key] : ''}
      onChange={(v) => setInputs((s) => ({ ...s, [key]: v }))}
      placeholder={connections[key] ? 'Salvo · preencha para substituir' : 'Ainda não configurado'}
    />
  );

  async function save() {
    setBusy(true);
    try {
      await api('admin/integrations', { method: 'PUT', body: JSON.stringify(inputs) });
      setInputs({});
      await onSaveSettings();
      await onSaved();
      toast.success('Conexões e configurações salvas com sucesso!');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function testTag() {
    setTestingTag(true);
    try {
      const res = await api('admin/integrations/infinitepay/test', {
        method: 'POST',
        body: JSON.stringify({ tag: connections.infiniteTag }),
      });
      if (res.ok) toast.success('Validada: ' + res.name);
      else toast.error(res.error || 'Erro ao validar tag');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setTestingTag(false);
    }
  }

  async function runAITest(msg?: string) {
    const messageToSend = msg || testMessage;
    if (!messageToSend.trim()) return;
    setTestingAI(true);
    setTestReply(null);
    try {
      const res = await api('admin/openai/test', {
        method: 'POST',
        body: JSON.stringify({ message: messageToSend.trim() }),
      });
      if (res.ok && res.reply) {
        setTestReply(res.reply);
        toast.success('Resposta da IA gerada!');
      } else {
        toast.error('Não foi possível obter resposta.');
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setTestingAI(false);
    }
  }

  async function loadGraphReport() {
    if (graphReport) {
      setShowReport(!showReport);
      return;
    }
    setLoadingReport(true);
    try {
      const res = await api('admin/graph-report');
      if (res.ok && res.report) {
        setGraphReport(res.report);
        setShowReport(true);
      } else {
        toast.error('Relatório Graphify ainda não disponível.');
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoadingReport(false);
    }
  }

  function addAdminPhone() {
    const clean = newPhoneInput.replace(/\D/g, '');
    if (!/^55\d{10,11}$/.test(clean)) {
      toast.error('Número inválido. Use formato 55 + DDD + número (ex: 5574988218637)');
      return;
    }
    if (adminPhones.includes(clean)) {
      toast.error('Este número já está na lista.');
      return;
    }
    const updated = [...adminPhones, clean];
    onChange({ ...settings, adminNotifyPhones: updated });
    setNewPhoneInput('');
    toast.success('Número adicionado. Clique em Salvar conexões para persistir.');
  }

  function removeAdminPhone(phoneToRemove: string) {
    if (adminPhones.length <= 1) {
      toast.error('Mantenha pelo menos um número para receber notificações.');
      return;
    }
    const updated = adminPhones.filter((p) => p !== phoneToRemove);
    onChange({ ...settings, adminNotifyPhones: updated });
    toast.success('Número removido. Clique em Salvar conexões para persistir.');
  }

  const hook = (name: string) => (
    <Button
      variant="outline"
      onClick={() =>
        navigator.clipboard
          .writeText(origin + '/api/webhooks/' + name)
          .then(() => toast.success('URL de notificação copiada.'))
          .catch(() => toast.error('Não foi possível copiar.'))
      }
    >
      <Copy size={16} />
      Copiar URL de notificações
    </Button>
  );

  const isAIEnabled = inputs.openaiEnabled !== undefined
    ? inputs.openaiEnabled === '1'
    : connections.openaiEnabled;
  const currentModel = inputs.openaiModel || connections.openaiModel || 'gpt-5-mini';

  return (
    <>
      <div className="section-toolbar">
        <div>
          <h2>Conexões & Inteligência</h2>
          <p>WhatsApp Web, Atendimento Inteligente com OpenAI, Notificações de Bruna & Gabi e Pagamentos.</p>
        </div>
        <Button onClick={save} disabled={busy}>
          {busy ? <LoaderCircle className="spin" /> : <Check size={17} />}
          Salvar conexões
        </Button>
      </div>

      {/* WhatsApp Web.js Conector */}
      <WhatsAppWebJS onSaved={onSaved} />

      <div className="settings-grid">
        {/* OpenAI & Assistente Virtual no WhatsApp */}
        <section className="settings-card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={22} style={{ color: 'var(--brand-accent, #e11d48)' }} />
              OpenAI & Atendimento Inteligente no WhatsApp
            </h3>
            <span
              className="connection-pill"
              style={{
                backgroundColor: connections.openaiKey && isAIEnabled
                  ? 'rgba(16, 185, 129, 0.15)'
                  : connections.openaiKey
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'rgba(156, 163, 175, 0.15)',
                color: connections.openaiKey && isAIEnabled
                  ? '#059669'
                  : connections.openaiKey
                  ? '#d97706'
                  : '#6b7280',
                border: '1px solid currentColor',
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              {connections.openaiKey && isAIEnabled
                ? '🟢 IA Conectada e Ativa'
                : connections.openaiKey
                ? '🟡 Chave Salva (Pausada)'
                : '⚪ Não Configurado'}
            </span>
          </div>

          <p style={{ marginTop: '8px', color: 'var(--muted-foreground)' }}>
            O assistente responde clientes no WhatsApp automaticamente baseado no <strong>catálogo e nas regras atuais da loja</strong>,
            com preços em tempo real e links diretos dos produtos para compra no site.
          </p>

          <div className="form-stack" style={{ marginTop: '16px' }}>
            {/* Chave de API */}
            {field('openaiKey', 'Chave de API da OpenAI (sk-...)')}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              {/* Modelo */}
              <label className="field">
                <span style={{ fontWeight: 600 }}>Modelo da OpenAI</span>
                <Select
                  value={currentModel}
                  onValueChange={(v) => setInputs((s) => ({ ...s, openaiModel: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-5-mini">gpt-5-mini (Padrão · Rápido e ultra econômico)</SelectItem>
                    <SelectItem value="gpt-5-nano">gpt-5-nano (Ultra leve · Menor custo)</SelectItem>
                    <SelectItem value="gpt-4o-mini">gpt-4o-mini (Equilibrado e inteligente)</SelectItem>
                    <SelectItem value="gpt-4o">gpt-4o (Avançado)</SelectItem>
                  </SelectContent>
                </Select>
                <small className="small-muted">Cada teste e resposta utiliza a API da OpenAI. O custo depende do modelo e do tamanho da conversa.</small>
              </label>

              {/* Status do robô */}
              <label className="field">
                <span style={{ fontWeight: 600 }}>Status do Atendimento Automático</span>
                <Select
                  value={isAIEnabled ? '1' : '0'}
                  onValueChange={(v) => setInputs((s) => ({ ...s, openaiEnabled: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Ativado (Responde clientes no WhatsApp)</SelectItem>
                    <SelectItem value="0">Pausado (Somente atendimento manual)</SelectItem>
                  </SelectContent>
                </Select>
                <small className="small-muted">Se Bruna ou Gabi responderem no WhatsApp, a IA pausa automaticamente por 30 min.</small>
              </label>
            </div>

            {/* Prompt customizado */}
            <label className="field">
              <span style={{ fontWeight: 600 }}>Instruções personalizadas para a IA</span>
              <Textarea
                placeholder="Exemplo: Bolos decorados requerem 48h de antecedência. Não fazemos entregas aos domingos após 14h. Em caso de dúvidas sobre alergenos (glúten/lactose), avise a equipe."
                rows={3}
                value={inputs.openaiPrompt !== undefined ? inputs.openaiPrompt : (connections.openaiPrompt || '')}
                onChange={(e) => setInputs((s) => ({ ...s, openaiPrompt: e.target.value }))}
              />
              <small className="small-muted">Estas regras complementam o mapa estruturado e os produtos da loja.</small>
            </label>

            {/* Simulador de Teste da IA */}
            <div
              style={{
                marginTop: '12px',
                padding: '16px',
                backgroundColor: 'var(--surface-sunken, rgba(0,0,0,0.03))',
                borderRadius: '8px',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} style={{ color: 'var(--brand-accent, #e11d48)' }} />
                  Testar Resposta da IA com o Mapa do Site
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>Simulação em tempo real</span>
              </div>

              {/* Chips de perguntas rápidas */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setTestMessage('Quanto custa o bolo de morango e como faço para pedir?');
                    void runAITest('Quanto custa o bolo de morango e como faço para pedir?');
                  }}
                  style={{
                    fontSize: '0.8rem',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    cursor: 'pointer',
                  }}
                >
                  🍰 Preço do bolo e link
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTestMessage('Vocês fazem bolo para festa de aniversário personalizada?');
                    void runAITest('Vocês fazem bolo para festa de aniversário personalizada?');
                  }}
                  style={{
                    fontSize: '0.8rem',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    cursor: 'pointer',
                  }}
                >
                  🎂 Encomenda personalizada
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTestMessage('Quero falar com a Bruna ou um atendente humano');
                    void runAITest('Quero falar com a Bruna ou um atendente humano');
                  }}
                  style={{
                    fontSize: '0.8rem',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    cursor: 'pointer',
                  }}
                >
                  🙋 Falar com atendente
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input"
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Digite uma mensagem simulada de cliente..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void runAITest();
                    }
                  }}
                />
                <Button onClick={() => void runAITest()} disabled={testingAI || !connections.openaiKey}>
                  {testingAI ? <LoaderCircle className="spin size-4" /> : <Send size={15} />}
                  Testar
                </Button>
              </div>

              {testReply && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '12px 16px',
                    backgroundColor: 'var(--background)',
                    borderRadius: '8px',
                    borderLeft: '4px solid var(--brand-accent, #e11d48)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '4px' }}>
                    Resposta gerada pelo assistente (com dados reais e links do site):
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem', lineHeight: '1.45' }}>{testReply}</div>
                </div>
              )}
            </div>

            {/* Graphify Architecture Map Viewer */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)' }}>
                  Relatório técnico do <strong>Graphify</strong> incluído nesta versão. As respostas usam o catálogo e as regras atuais da loja.
                </span>
                <Button variant="outline" size="sm" onClick={loadGraphReport} disabled={loadingReport}>
                  <Network size={15} />
                  {loadingReport ? 'Carregando...' : showReport ? 'Ocultar Mapa Graphify' : 'Ver Mapa do Sistema Graphify'}
                </Button>
              </div>

              {showReport && graphReport && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '16px',
                    backgroundColor: 'var(--surface-sunken)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    maxHeight: '350px',
                    overflowY: 'auto',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {graphReport}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Notificações no WhatsApp de Bruna e Gabi */}
        <section className="settings-card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BellRing size={20} style={{ color: '#10b981' }} />
              Notificações de Pedidos e Pagamentos no WhatsApp
            </h3>
            <span
              className="connection-pill"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#059669',
                border: '1px solid currentColor',
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              🔔 2 Telefones Ativos
            </span>
          </div>

          <p style={{ marginTop: '8px', color: 'var(--muted-foreground)' }}>
            Todos os <strong>novos pedidos</strong>, <strong>confirmações de pagamento (Pix/cartão)</strong>,{' '}
            <strong>pedidos de orçamento</strong> e <strong>solicitações de atendimento humano</strong> são enviados
            automaticamente para os números da Bruna e da Gabi:
          </p>

          <div className="form-stack" style={{marginTop:'14px'}}>
            {adminPhones.map(phone=><div className="notice" key={phone}><strong>{phone==='5574988218637'?'Bruna':phone==='5574988546993'?'Gabi':'Equipe'}</strong> · +{phone}<small className="small-muted"> Número cadastrado para avisos. A entrega depende da conexão do WhatsApp.</small></div>)}
          </div>

          <details style={{ marginTop: '16px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--brand-accent, #e11d48)' }}>
              Configurar números adicionais de notificação da equipe
            </summary>
            <div className="form-stack" style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="5574988218637"
                  className="input"
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  value={newPhoneInput}
                  onChange={(e) => setNewPhoneInput(e.target.value)}
                />
                <Button variant="outline" onClick={addAdminPhone}>
                  Adicionar telefone
                </Button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                {adminPhones.map((p) => (
                  <span
                    key={p}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      backgroundColor: 'var(--surface-sunken)',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                    }}
                  >
                    +{p}
                    <button
                      type="button"
                      onClick={() => removeAdminPhone(p)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#ef4444',
                        fontWeight: 'bold',
                      }}
                      title="Remover número"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </details>
        </section>

        {/* Pagamento Online - Provedor Principal */}
        <section className="settings-card">
          <h3>
            <Wallet size={20} />
            Pagamento on-line
          </h3>
          <div className="form-stack">
            <label className="field">
              <span>Provedor principal</span>
              <Select
                value={settings.paymentProvider}
                onValueChange={(v: any) => onChange({ ...settings, paymentProvider: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="infinitepay">InfinitePay</SelectItem>
                  <SelectItem value="picpay">PicPay</SelectItem>
                  <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                  <SelectItem value="pagbank">PagBank</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600, paddingTop: '8px', paddingBottom: '8px' }}>
                Pix com conferência manual
              </summary>
              <div className="form-stack">
                <Field label="Chave Pix" value={settings.pixKey} onChange={(v) => onChange({ ...settings, pixKey: v.trim() })} />
                <Field label="Nome do titular" value={settings.pixName} onChange={(v) => onChange({ ...settings, pixName: v })} />
                <Field label="Cidade" value={settings.pixCity} onChange={(v) => onChange({ ...settings, pixCity: v })} />
              </div>
              <p className="small-muted">Usado caso nenhum provedor acima esteja conectado.</p>
            </details>
          </div>
        </section>

        {/* InfinitePay */}
        <section className="settings-card">
          <h3>
            <Wallet size={20} />
            InfinitePay <small>· padrão</small>
          </h3>
          <span className="connection-pill">{connections.infiniteTag ? 'Tag salva' : 'Não configurado'}</span>
          <p>Pix e cartão no checkout da InfinitePay. A confirmação volta automaticamente ao pedido.</p>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600, paddingTop: '8px', paddingBottom: '8px' }}>
              Configuração técnica
            </summary>
            <div className="form-stack">
              {connections.infiniteTag && !inputs.infiniteTag_edit ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '8px 12px',
                    background: 'var(--surface-sunken)',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                  }}
                >
                  <span style={{ flex: 1 }}>
                    Tag da loja: <strong>${connections.infiniteTag}</strong>
                  </span>
                  <Button variant="outline" size="sm" onClick={testTag} disabled={testingTag}>
                    {testingTag ? <LoaderCircle className="spin size-3" /> : 'Testar tag'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setInputs((s) => ({ ...s, infiniteTag_edit: '1' }))}>
                    Alterar
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>{field('infiniteTag', 'InfiniteTag da confeitaria', false)}</div>
                  <Button onClick={save} disabled={busy || !inputs.infiniteTag}>
                    Ativar
                  </Button>
                </div>
              )}
              <p className="small-muted">Informe a tag da conta, sem o cifrão. Exemplo: confeitando.</p>
              {hook('infinitepay')}
            </div>
            <a href="https://www.infinitepay.io/checkout-documentacao" target="_blank" rel="noreferrer">
              Ajuda da InfinitePay ↗
            </a>
          </details>
        </section>

        {/* Mercado Pago */}
        <section className="settings-card">
          <h3>
            <Wallet size={20} />
            Mercado Pago
          </h3>
          <span className="connection-pill">
            {connections.mpToken && connections.mpWebhookSecret ? 'Credenciais salvas' : 'Não configurado'}
          </span>
          <p>Pix e cartão dentro do site. Configure a Public Key para habilitar o formulário de cartão.</p>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600, paddingTop: '8px', paddingBottom: '8px' }}>
              Configuração técnica
            </summary>
            <div className="form-stack">
              {field('mpToken', 'Access Token de produção')}
              {field('mpPublicKey', 'Public Key de produção', false)}
              {field('mpWebhookSecret', 'Assinatura secreta das notificações')}
              {hook('mercadopago')}
            </div>
            <div className="setup-guide">
              <p>
                Em Suas integrações no Mercado Pago, copie o Access Token. Configure a URL de notificações acima para o
                evento Pagamentos e salve a assinatura secreta aqui.
              </p>
              <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noreferrer">
                Abrir integrações ↗
              </a>
            </div>
          </details>
        </section>

        {/* PagBank */}
        <section className="settings-card">
          <h3>
            <Wallet size={20} />
            PagBank / PagSeguro
          </h3>
          <span className="connection-pill">{connections.pbToken ? 'Token salvo' : 'Não configurado'}</span>
          <p>Pix e cartão no checkout do PagBank, com atualização automática.</p>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600, paddingTop: '8px', paddingBottom: '8px' }}>
              Configuração técnica
            </summary>
            <div className="form-stack">
              {field('pbToken', 'Token de produção')}
              {hook('pagbank')}
            </div>
            <p className="small-muted">A conta precisa estar habilitada para a API de Checkout.</p>
            <a href="https://developer.pagbank.com.br/" target="_blank" rel="noreferrer">
              Ajuda do PagBank ↗
            </a>
          </details>
        </section>

        {/* PicPay */}
        <section className="settings-card">
          <h3>
            <Wallet size={20} />
            PicPay
          </h3>
          <span className="connection-pill">
            {connections.ppClientId && connections.ppClientSecret ? 'Credenciais salvas' : 'Não configurado'}
          </span>
          <p>Pix dentro do site. A confirmação é consultada diretamente na conta PicPay.</p>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600, paddingTop: '8px', paddingBottom: '8px' }}>
              Configuração técnica
            </summary>
            <div className="form-stack">
              {field('ppClientId', 'Client ID')}
              {field('ppClientSecret', 'Client Secret')}
              {field('ppWebhookToken', 'Token das notificações')}
              {hook('picpay')}
              <p className="small-muted">
                Em Ajustes → Meu checkout, cadastre a URL de notificações. Salve aqui o token exibido pelo PicPay.
              </p>
            </div>
            <a href="https://painel-empresas.picpay.com/" target="_blank" rel="noreferrer">
              Abrir painel PicPay Empresas ↗
            </a>
          </details>
        </section>
      </div>
    </>
  );
}
