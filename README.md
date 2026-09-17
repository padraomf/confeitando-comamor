# Confeitando com Amor

Catálogo e painel em português, React/Vinext, D1 para dados e R2 para fotos. Projeto existente no Sites, com o mesmo proprietário e público. Pedidos e acessos locais foram zerados a pedido do responsável na migração 0007. O banco de produção é migrado pelos arquivos Drizzle no deploy; dados de teste não são publicados.

## Funcionalidades

- Catálogo por categoria, sacola persistente, convidados, contas de cliente, curtidas, comentários e compartilhamento com prévia própria de cada produto.
- Retirada sem endereço/frete, dinheiro ou maquininha junto do online, opção de exigir pagamento antecipado e código de conferência no balcão.
- InfinitePay por InfiniteTag como padrão para lojas novas; Mercado Pago com cartão interno via Card Payment Brick e 3DS quando há Public Key, PagBank com checkout de cartão e Pix nativo Mercado Pago/PicPay. Os provedores existentes mantêm sua configuração.
- Pix manual com foto de comprovante privada e análise no painel. Comprovante nunca confirma pagamento automaticamente.
- Frete pelas ruas via openrouteservice, mapas OpenStreetMap, mínimo de frete, raio máximo e cotação vinculada ao endereço/ponto, cliente e prazo.
- Pedidos, etapas por tipo, pagamentos independentes, auditoria, clientes, histórico com filtros e CSV, originais de imagens preservados em armazenamento privado.
- Duas vias de impressão com linha de corte. Via do entregador/loja: cobrança, troco, contato e QR do destino. Via do cliente: itens e valores. O QR abre o destino no aplicativo de mapas; o cálculo de frete não usa Google.
- Equipe: administradora, atendimento e produção. Senhas scrypt, cookies seguros, sessão revogável e limitação de tentativas.
- Encomendas: bolos de 12/20/30 fatias e docinhos a partir de 100 unidades, referência privada e proposta, sinal, aceite/recusa e conversão em pedido nas condições aprovadas.
- WhatsApp por QR: bridge Node independente, LocalAuth, heartbeat, reconexão, fila por evento e journal. Instalador em `/downloads/whatsapp-bridge.zip` e no painel Conexões.
- Favicon com a imagem original do coração. Sitemap dinâmico, robots e links individuais de produtos. Fotos demonstrativas ficam restritas ao painel até a dona editar como produtos reais.

## Ativação pela loja

A loja começa fechada sem produtos reais. O responsável mantém o acesso já existente; em primeiro acesso, usa a identidade do proprietário e o código de ativação configurado no ambiente. A equipe utiliza login e senha criados pela administradora.

Em Minha loja, cadastre endereço/ponto no mapa, horários, regras de frete e pagamentos presenciais. Em Conexões, cadastre as contas que serão utilizadas. O código não contém chaves de bancos. Credenciais ficam cifradas no banco usando `APP_SECRET`; preserve esse segredo ao atualizar o site. `PUBLIC_URL` aponta para o endereço de produção. `ADMIN_SETUP_CODE` protege a primeira ativação.

- InfinitePay: InfiniteTag; checkout externo e conferência por `/payment_check` antes de marcar Pago.
- Mercado Pago: Access Token, Public Key e segredo do webhook. Pix via `/v1/payments` com chave de idempotência, QR interno e reconciliação. Cartão interno tokenizado pelo SDK, à vista, com suporte a 3DS. Sem Public Key configurada, permanece o Checkout Pro externo.
- PagBank: token de produção habilitado para Checkout e assinatura do webhook validada.
- PicPay: Client ID/Secret e token de notificação configurados em Ajustes → Meu checkout. A notificação é verificada e o servidor consulta o pagamento na conta.
- Rotas: chave openrouteservice. Serviço gratuito dentro de sua cota, sujeito às condições do provedor.
- WhatsApp: não exige credenciais da Meta; exige instalar a bridge em computador/servidor sempre ligado e ler o QR. A hospedagem do site em Worker não executa Chromium/Node permanentemente. Não há serviço externo provisionado por este repositório. Veja `whatsapp-bridge/INSTALAR.md`.

O WhatsApp é uma integração não oficial, sujeita a alterações/restrições da plataforma. Mensagens incertas são sinalizadas para conferência e não reenviadas cegamente. Pagamento antecipado reduz o risco de faltas na retirada; dinheiro não oferece essa garantia. Cancelar pedido não estorna o pagamento: a devolução é realizada na conta do provedor.

## Validação

```
node tests/commerce.test.mjs
node --test whatsapp-bridge/test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

A suíte usa SQLite real, todas as migrações, hashing real e provedores simulados. Não faz cobranças nem envia WhatsApp. Cobre autorização, sessão, pedidos idempotentes, frete, QR decodificado, valor/moeda do pagamento, retirada, comprovantes, imagens, relatórios e fila de mensagens. O funcionamento com contas reais depende das configurações da loja e de validação autorizada.

O catálogo e a sacola foram conferidos no navegador interno. A navegação das nove áreas do painel foi conferida em uma prévia isolada dos componentes reais, com dados fictícios. O backend é verificado pela suíte com sessões de teste. O painel precisa permanecer aberto para tocar os sons; navegadores podem suspender abas em segundo plano.

## Desenvolvimento e dados

Instale as dependências pelo helper Sites; inicie pelo `sites-preview start "$PWD"`. Build pelo `scripts/build-site.mjs` do plugin Sites. Nunca altere migrações já publicadas: edite `db/schema.ts` e gere uma nova com Drizzle.

Estoque opcional é reservado atomicamente ao registrar o pedido; a edição de detalhes preserva reservas simultâneas. Recompra revisa preços e disponibilidade. Categorias e produtos têm ordenação. Recebimentos parciais e devoluções ficam em registro próprio, com relatórios por data do pedido ou data do recebimento.

Histórico: paginação 40 pedidos, exportação limitada a 10.000 linhas por filtro. Pedidos operacionais: até 200, priorizando pendências e depois os mais recentes; o histórico permite consultar os demais. Clientes: busca por nome/telefone, até 200 resultados. Produtos: máximo de 30 unidades por item na sacola.

Fontes das imagens demonstrativas antigas: `public/images/sources.json`. `celebration.webp` é uma imagem ilustrativa gerada para o convite a encomendas; não representa inventário real. As imagens originais da marca são mantidas no projeto.

Detalhes da entrega, primeiro acesso após limpeza, estrutura completa e ativação das conexões: [ENTREGA.md](ENTREGA.md).
