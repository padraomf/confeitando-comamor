import { db, settings, secrets, products, categoryList, runtime } from './server';
import {paymentAllowed} from './payment-options';
import {paymentReady} from './payment-connect';
import { money, type Product } from './commerce';
import { productPath } from './product-sharing';
import { categorySlug } from './category-path';
import { businessStatus } from './store-hours';

let chatsTableInitialized = false;

export async function ensureChatsTable() {
  if (chatsTableInitialized) return;
  try {
    await db().prepare(`
      CREATE TABLE IF NOT EXISTS whatsapp_chats (
        phone TEXT PRIMARY KEY,
        history TEXT NOT NULL DEFAULT '[]',
        handover_until INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0
      )
    `).run();
    chatsTableInitialized = true;
  } catch (err) {
    console.error('Falha ao inicializar tabela whatsapp_chats:', err);
  }
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/**
 * Constrói o mapa de conhecimento estruturado e otimizado em tokens
 * baseado na extração Graphify do sistema e nos dados dinâmicos do catálogo.
 */
export async function buildSiteKnowledge(origin: string) {
  const [store, items, categories] = await Promise.all([
    settings(),
    products(),
    categoryList(),
  ]);

  const activeProducts = (items as Product[]).filter((p) => p.active && !p.demo);
  const status = businessStatus(store);

  // Mapeamento dos produtos com preços e URLs diretas
  const catalogLines = activeProducts.map((p) => {
    const link = origin + productPath(p.id, p.name);
    const price = money(p.price);
    const tag = p.tag ? ` [${p.tag}]` : '';
    const stock = p.sold_out || p.stock === 0 ? ' (Esgotado)' : p.stock != null ? ` (Estoque: ${p.stock})` : '';
    return `▪ ${p.name}${tag}: ${price}${stock} — ${p.description.slice(0, 140)}\n  Link para comprar: ${link}`;
  });

  const categoryLines = categories.map((c) => {
    return `- ${c}: ${origin}/categoria/${categorySlug(c)}`;
  });
  const integrations=await secrets();
  const online=paymentReady(integrations,store.paymentProvider);
  const labels={cash:'Dinheiro',card_machine:'Maquininha',pix:'Pix',card:'Cartão online'} as const;
  const paymentSummary=['delivery','pickup'].filter(mode=>mode==='delivery'||store.pickup).map(mode=>`${mode==='pickup'?'Retirada':'Entrega'}: ${Object.entries(labels).filter(([method])=>paymentAllowed(store,mode,method as keyof typeof labels,online)).map(([,label])=>label).join(', ')||'Consulte a equipe'}`).join('; ');

  const hoursSummary = store.hours
    ? store.hours
        .filter((h) => h.enabled)
        .map((h) => {
          const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
          return `${days[h.day]}: ${h.open} às ${h.close}`;
        })
        .join(', ')
    : 'Seg a Sáb: 09:00 às 18:00';

  return `VOCÊ É O ASSISTENTE VIRTUAL DA CONFEITARIA "${store.name || 'Confeitando com Amor'}".
Seu objetivo é atender clientes no WhatsApp de forma calorosa, ágil, educada e precisa, incentivando a compra através do nosso site.

---
MAPA DO SISTEMA & ROTAS DO SITE (Baseado na estrutura Graphify):
1. Início / Vitrine: ${origin}
2. Cardápio Completo: ${origin}/catalogo
3. Encomendas Personalizadas / Orçamentos: ${origin}/encomendas (o cliente escolhe tema, data, sabores e pode enviar fotos de referência)
4. Sacola de Compras: ${origin}/sacola
5. Acompanhar Pedidos: ${origin}/pedidos (o cliente consulta status e dados de pagamento)

CATEGORIAS NO SITE:
${categoryLines.join('\n')}

---
CARDÁPIO ATUAL COM PREÇOS E LINKS DIRETOS:
${catalogLines.length ? catalogLines.join('\n\n') : 'Consulte nosso catálogo online em ' + origin + '/catalogo'}

${store.cakeFlavors?.length ? `SABORES DE BOLO PARA ENCOMENDA: ${store.cakeFlavors.join(', ')}` : ''}
${store.sweetFlavors?.length ? `SABORES DE DOCINHOS: ${store.sweetFlavors.join(', ')}` : ''}

---
FUNCIONAMENTO & REGRAS DA LOJA:
- Situação atual: ${status.label} (${status.detail})
- Horários de atendimento: ${hoursSummary}
- Tempo estimado de preparo: ${store.prepMin} a ${store.prepMax} minutos
- Endereço da loja para retirada: ${store.storeAddress || 'Consulte no site'}
- Formas de pagamento habilitadas: ${paymentSummary}
- Entregas: Calculadas diretamente no site de acordo com o endereço/localização do cliente.

---
DIRETRIZES OBRIGATÓRIAS DE RESPOSTA NO WHATSAPP:
1. Responda em português brasileiro com tom carinhoso, simpático e objetivo. Use poucos emojis delicados (🍰, 🍓, ✨, 🎂, 😊).
2. SEMPRE que mencionar um doce ou categoria, informe o PREÇO EXATO e o LINK COMPLETO do site para o cliente clicar e pedir.
3. Se o cliente quiser um bolo decorado ou orçamento especial que não está na lista padrão, direcione-o para enviar a solicitação com foto em: ${origin}/encomendas
4. Se o cliente perguntar sobre um pedido já feito, recomende acessar sua conta em: ${origin}/pedidos. Não consulte ou revele pedidos de outros clientes.
5. Se o cliente solicitar explicitamente falar com um atendente humano, com a Bruna ou com a Gabi, diga com carinho que já avisou a equipe e que uma atendente humana responderá em instantes.
6. Nunca invente preços, promoções ou produtos que não estão neste mapa. Mantenha respostas concisas para leitura rápida no WhatsApp.
7. Não gaste tokens com introduções longas; seja direto, doce e prestativo.`;
}

/**
 * Consulta status de um pedido caso o cliente mencione um código (ex: #ABC12345 ou E-12345)
 */
export async function lookupOrderContext(text: string, phone: string) {
  const match = text.match(/#?([a-fA-F0-9]{8}|E-[a-fA-F0-9]{8})/);
  if (!match) return null;
  const rawCode = match[1].toUpperCase();

  try {
    const rawOrder = await db()
      .prepare('SELECT code, status, total, payment, payment_status, created_at, data FROM orders WHERE code = ? OR code = ? LIMIT 1')
      .bind(rawCode, rawCode.replace(/^#/, ''))
      .first<any>();

    if (rawOrder) {
      const data=JSON.parse(rawOrder.data);
      const customerPhone=String(data.profile?.phone||'').replace(/\D/g,'');
      if(!customerPhone || (customerPhone.length>11?customerPhone:'55'+customerPhone)!==phone.replace(/\D/g,''))return null;
      return `[PEDIDO DO CLIENTE: #${rawOrder.code}, Status: "${rawOrder.status}", Pagamento: "${rawOrder.payment_status}", Total: "${money(rawOrder.total)}".]`;
    }
  } catch {}
  return null;
}

/**
 * Executa a chamada à API da OpenAI via Chat Completions
 */
export async function callOpenAI({
  apiKey,
  model = 'gpt-5-mini',
  messages,
}: {
  apiKey: string;
  model?: string;
  messages: ChatMessage[];
}): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-5-mini',
      messages,
      ...(/^gpt-5(?:-mini|-nano)?$/.test(model)?{reasoning_effort:'minimal'}:{}),
      max_completion_tokens: 1500,
      store: false,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    const errData: any = await response.json().catch(() => ({}));
    console.error('OpenAI request failed',response.status,errData?.error?.code||'unknown');
    throw new Error(`A OpenAI não respondeu ao teste (HTTP ${response.status}). Confira a chave, o modelo e o saldo da API.`);
  }

  const result: any = await response.json();
  return result.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Processa mensagens recebidas pelo WhatsApp Bridge
 */
export async function processIncomingWhatsApp({
  phone,
  text,
  senderName,
  isFromMe,
  domain,
}: {
  phone: string;
  text: string;
  senderName?: string;
  isFromMe: boolean;
  domain: string;
}): Promise<{ reply: string | null; action?: string }> {
  await ensureChatsTable();
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone) return { reply: null };

  const s = await secrets();
  const apiKey = runtime.OPENAI_API_KEY || s.openaiKey;
  const config=await settings();
  if(!config.whatsappEnabled||config.whatsappMode!=='webjs')return {reply:null,action:'whatsapp_disabled'};

  // Se a mensagem partiu da loja/Bruna/Gabi (fromMe), ativa modo atendente humano por 30 minutos
  if (isFromMe) {
    const handoverUntil = Date.now() + 30 * 60 * 1000;
    await db()
      .prepare(`
        INSERT INTO whatsapp_chats(phone, history, handover_until, updated_at)
        VALUES(?, '[]', ?, ?)
        ON CONFLICT(phone) DO UPDATE SET handover_until = excluded.handover_until, updated_at = excluded.updated_at
      `)
      .bind(cleanPhone, handoverUntil, Date.now())
      .run();
    return { reply: null, action: 'human_takeover_started' };
  }

  // Verifica se o chat está sob controle de atendente humano
  const chatRow = await db()
    .prepare('SELECT history, handover_until FROM whatsapp_chats WHERE phone = ?')
    .bind(cleanPhone)
    .first<any>();

  const now = Date.now();
  if (chatRow && chatRow.handover_until > now) {
    // Atendente humano está conversando, IA permanece em silêncio
    return { reply: null, action: 'human_takeover_active' };
  }

  // Verifica se a IA está configurada e habilitada
  if (!apiKey || s.openaiEnabled === '0') {
    return { reply: null, action: 'openai_not_configured' };
  }

  // Detecta se o cliente pediu para falar com atendente / humano
  const asksHuman = /atendente|humano|falar com (a )?(bruna|gabi|algu[ée]m|pessoa)|atendimento humano/i.test(text);
  if (asksHuman) {
    const handoverUntil = now + 30 * 60 * 1000;
    await db()
      .prepare(`
        INSERT INTO whatsapp_chats(phone, history, handover_until, updated_at)
        VALUES(?, '[]', ?, ?)
        ON CONFLICT(phone) DO UPDATE SET handover_until = excluded.handover_until, updated_at = excluded.updated_at
      `)
      .bind(cleanPhone, handoverUntil, now)
      .run();

    // Notifica Bruna e Gabi no WhatsApp
    await notifyAdminsHumanRequest(cleanPhone, senderName || 'Cliente', text);

    return {
      reply: 'Entendido! 🌸 Já avisei a Bruna e a Gabi. Uma de nós irá te responder pessoalmente aqui em instantes!',
      action: 'transferred_to_human',
    };
  }

  // Recupera histórico recente de mensagens do cliente
  let history: ChatMessage[] = [];
  try {
    if (chatRow?.history) {
      history = JSON.parse(chatRow.history);
      if (!Array.isArray(history)) history = [];
    }
  } catch {
    history = [];
  }

  // Monta o conhecimento do sistema
  const systemPrompt = await buildSiteKnowledge(domain);
  const customInstructions = s.openaiPrompt ? `\n\nINSTRUÇÕES ADICIONAIS DA CONFEITARIA:\n${s.openaiPrompt}` : '';

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt + customInstructions },
    // Mantém as últimas 4 mensagens para contexto com baixo consumo de tokens
    ...history.slice(-4),
  ];

  // Adiciona contexto do pedido caso tenha mencionado um código
  const orderContext = await lookupOrderContext(text,cleanPhone);
  if (orderContext) {
    messages.push({ role: 'system', content: orderContext });
  }

  messages.push({ role: 'user', content: text });

  try {
    const reply = await callOpenAI({
      apiKey,
      model: s.openaiModel || 'gpt-5-mini',
      messages,
    });

    if (reply) {
      const current=await db().prepare('SELECT handover_until FROM whatsapp_chats WHERE phone=?').bind(cleanPhone).first<{handover_until:number}>();
      if(current&&current.handover_until>Date.now())return {reply:null,action:'human_takeover_active'};
      // Salva histórico atualizado
      const updatedHistory: ChatMessage[] = [
        ...history.slice(-6),
        { role: 'user', content: text },
        { role: 'assistant', content: reply },
      ];

      await db()
        .prepare(`
          INSERT INTO whatsapp_chats(phone, history, handover_until, updated_at)
          VALUES(?, ?, 0, ?)
          ON CONFLICT(phone) DO UPDATE SET history = excluded.history, updated_at = excluded.updated_at
        `)
        .bind(cleanPhone, JSON.stringify(updatedHistory), now)
        .run();

      return { reply };
    }
  } catch (error: any) {
    console.error('Erro na chamada da OpenAI para WhatsApp:', error.message);
  }

  return { reply: null };
}

/**
 * Notifica Bruna e Gabi quando um cliente solicita atendimento humano
 */
export async function notifyAdminsHumanRequest(customerPhone: string, customerName: string, message: string) {
  try {
    const config = await settings();
    const phones = config.adminNotifyPhones?.length ? config.adminNotifyPhones : ['5574988218637', '5574988546993'];
    const text = `🙋 ATENDIMENTO HUMANO SOLICITADO!\n\nCliente: ${customerName}\nWhatsApp: +${customerPhone}\nMensagem: "${message}"\n\nA IA pausou as respostas automáticas para este cliente por 30 minutos.`;

    for (const phone of phones) {
      const clean = phone.replace(/\D/g, '');
      const id = `human-req-${clean}-${crypto.randomUUID()}`;
      await db()
        .prepare('INSERT OR IGNORE INTO whatsapp_outbox(id, order_id, recipient, phone, status, created_at, updated_at, event, detail) VALUES(?,?,?,?,?,?,?,?,?)')
        .bind(id, 'atendimento', 'loja', clean, 'queued', Date.now(), Date.now(), 'Atendimento', text)
        .run();
    }
  } catch (err) {
    console.error('Erro ao notificar atendentes humanos:', err);
  }
}
