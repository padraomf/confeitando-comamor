'use client';
import { useState } from 'react';
import {
  Wallet,
  Check,
  LoaderCircle,
  Copy,
  Bot,
  BellRing,
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
    toast.success('Número adicionado. Clique em Salvar conexões para confirmar.');
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

  return (
    <>
      <div className="section-toolbar">
        <div>
          <h2>Conexões</h2>
          <p>Cuide do WhatsApp, do atendimento e dos avisos da loja.</p>
        </div>
        <Button onClick={save} disabled={busy}>
          {busy ? <LoaderCircle className="spin" /> : <Check size={17} />}
          Salvar conexões
        </Button>
      </div>

      {/* WhatsApp Web.js Conector */}
      <WhatsAppWebJS onSaved={onSaved} />

      <div className="settings-grid">
        <section className="settings-card" style={{gridColumn:'1 / -1'}}>
          <div className="section-toolbar">
            <h3><Bot size={20}/>Atendimento automático</h3>
            <span className="connection-pill">{!connections.openaiKey?'Aguardando configuração':isAIEnabled?'Ativado':'Pausado'}</span>
          </div>
          <p>Ajude seus clientes com dúvidas sobre os doces, preços e como fazer um pedido pelo site.</p>
          <div className="form-stack">
            <label className="field">
              <span>Responder clientes automaticamente</span>
              <Select value={isAIEnabled?'1':'0'} onValueChange={value=>setInputs(current=>({...current,openaiEnabled:value}))} disabled={!connections.openaiKey}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="1">Ativado</SelectItem><SelectItem value="0">Pausado</SelectItem></SelectContent>
              </Select>
              <small className="small-muted">Quando você ou alguém da equipe responder à conversa, o atendimento automático pausa por 30 minutos.</small>
            </label>
            {!connections.openaiKey&&<p className="notice">O suporte está preparando este recurso para sua loja.</p>}
            <details>
              <summary>Orientações para o atendimento</summary>
              <label className="field" style={{marginTop:'12px'}}>
                <span>O que o atendimento precisa saber?</span>
                <Textarea rows={3} placeholder="Exemplo: encomendas de bolos decorados devem ser feitas com dois dias de antecedência."
                  value={inputs.openaiPrompt!==undefined?inputs.openaiPrompt:(connections.openaiPrompt||'')}
                  onChange={event=>setInputs(current=>({...current,openaiPrompt:event.target.value}))}/>
                <small className="small-muted">Acrescente combinações e cuidados da loja. Os produtos e preços já são consultados no catálogo.</small>
              </label>
            </details>
          </div>
        </section>

        {/* Notificações no WhatsApp de Bruna e Gabi */}
        <section className="settings-card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BellRing size={20} style={{ color: '#10b981' }} />
              Avisos para a equipe
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
              {adminPhones.length} {adminPhones.length===1?'número cadastrado':'números cadastrados'}
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
              Alterar quem recebe os avisos
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
