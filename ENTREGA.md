# Confeitando com Amor — código completo da estrutura

Atualização de 17/09/2026.

## Conteúdo do ZIP

Código-fonte do catálogo, finalização, área do cliente, painel, APIs, banco/migrações, imagens da marca, testes e serviço independente `whatsapp-bridge`. O pacote não leva pedidos, clientes, senhas, sessões, credenciais bancárias, banco de produção, fotos privadas enviadas por clientes nem dependências instaladas.

O projeto executa com React/Vinext, Cloudflare Workers, D1 e R2. Requer instalar as dependências e configurar a hospedagem; não é um HTML para abrir com duplo clique.

## Estrutura entregue

| Área | Comportamento |
|---|---|
| Catálogo | Categorias editáveis e ordenáveis, produtos ordenáveis, fotos, descrição, preço, destaques, pausa, esgotado e estoque opcional por quantidade. |
| Produtos | Página individual, prévia com foto para compartilhamento, curtidas e comentários com moderação. |
| Sacola | Flutuante em todas as páginas do cliente, quantidades persistidas neste navegador, remoção, observação do pedido e de cada produto. |
| Recompra | Reavalia preço, estoque e disponibilidade antes de substituir a sacola, com nova revisão e novo frete. |
| Cliente | Conta com senha e recuperação por código, compra como convidado, perfil e endereço reutilizáveis, histórico e link privado de acompanhamento. |
| Entrega | CEP, endereço, ponto confirmado no mapa, cálculo da rota pelas ruas e frete validado pelo servidor. |
| Retirada | Sem frete, endereço da loja, código de conferência e opção de exigir pagamento online antes de preparar. |
| Pagamentos | Dinheiro e maquininha junto das opções online; regras separadas para entrega e retirada; Pix manual quando não há provedor conectado. |
| Mercado Pago | Pix interno; cartão interno com Public Key, tokenização pelo SDK, 3DS e confirmação no servidor. Sem Public Key, conserva o checkout externo. Cartão interno à vista. |
| Outros provedores | InfinitePay por tag, checkout PagBank/PagSeguro e Pix PicPay, com conferência das notificações e dos valores. |
| Comprovantes | Fotos privadas e análise pela equipe; o envio de imagem nunca marca como pago. |
| Pedidos | Etapa separada do pagamento, filtros, próxima ação, horário da última atualização e sons distintos para chegada e pagamento. |
| Recebimentos | Sinal, recebimento parcial e saldo. Valores confirmados são registrados com data; confirmações repetidas não duplicam o recebimento. |
| Relatórios | Data do pedido ou do recebimento, filtros combinados, valores recebidos, saldo, devoluções, contestações, recorrência, produtos vendidos e CSV. |
| Impressão | Duas vias com linha de corte, A4 ou 80 mm, itens, observações, contato, situação financeira, saldo, troco e QR de localização para entrega. |
| Encomendas | Bolo de 12/20/30 fatias e docinhos a partir de 100, sabores cadastráveis, data, modalidade, endereço, referências originais privadas e versão leve. |
| Orçamentos | Proposta com preço, frete, sinal, condições e validade. Aceite/recusa pelo cliente e conversão única em pedido com a proposta aprovada. |
| Clientes no painel | Contatos, endereço, histórico e observações internas. |
| Equipe | Criação, edição, desativação, remoção, redefinição de senha e permissões de administradora, atendimento e produção. |
| Minha loja | Marca, logo, favicon, horários, intervalos, exceções, abrir/fechar temporariamente, preparo, frete e opções de pagamento. |
| WhatsApp | Conector Node separado, QR no painel, sessão persistida, heartbeat, reconexão, fila por evento e diário de envio. |
| SEO | Sitemap dinâmico, páginas de produtos e categorias, metadados, dados estruturados e campo de verificação Search Console. |

## Regras de operação

- Um pedido reserva o estoque de quantidade junto com sua criação. Cancelamento antes do preparo devolve esse estoque uma vez. Depois do preparo, cancelamentos e faltas na retirada exigem conferência manual da reposição para não recolocar comida preparada à venda automaticamente.
- Dinheiro na retirada continua permitido quando a loja escolher essa opção. Para reduzir pedidos não retirados, ative **Exigir pagamento online antes de preparar retiradas**. Dinheiro não garante comparecimento.
- Orçamento ainda não é reserva. Ao aceitar a proposta, o cliente gera o pedido; o preparo exige o sinal acordado. No pagamento online da encomenda, o valor total é cobrado antecipadamente. Para sinal parcial, a confeitaria confere e registra os recebimentos manuais e o saldo antes de concluir.
- Sinais e saldos aparecem no pedido e nas duas vias. A impressão registra o horário da consulta; a equipe deve conferir pagamentos recebidos depois da impressão.
- Cancelar pedido não devolve dinheiro no banco. A devolução é feita no provedor; a responsável pode registrar uma devolução manual já realizada. Notificações de estorno dos provedores suportados atualizam o relatório após conferência.
- Pix vencido é renovado somente depois de o banco confirmar a expiração. Uma tentativa de cartão com resposta incerta é conferida antes de permitir outra cobrança.
- Relatórios por recebimento usam a data de confirmação no site. Valores líquidos são após devoluções, antes de taxas do provedor. CSV: até 10.000 pedidos por filtro. A lista operacional prioriza até 200 pedidos pendentes/recentes; o histórico paginado dá acesso aos demais.

## Primeiro acesso após a limpeza solicitada

No site atual, os pedidos, cadastros e logins locais anteriores foram removidos pela migração 0007. A identidade da conta responsável foi preservada para recuperação; não há senha padrão.

1. Abra **Primeiro acesso** em `/primeiro-acesso`, ou escolha **Usar código de primeiro acesso** na tela do painel.
2. Cole o código recebido em particular e cadastre seu nome, login e senha de pelo menos 12 caracteres.
3. O painel abre com seu novo acesso de administradora. Depois, use o login e a senha escolhidos.
4. O código tem validade e só funciona uma vez, enquanto não há logins cadastrados. A conta ChatGPT responsável continua disponível para recuperar acessos.

A limpeza é uma migração única. Não reaplique `0007_reset_requested_records.sql` em um banco que já recebeu novas vendas. Atualizações posteriores não voltam a apagar pedidos.

## Ativação das conexões

| Conexão | O que a loja precisa informar/fazer |
|---|---|
| InfinitePay | InfiniteTag da conta que receberá o dinheiro. |
| Mercado Pago | Access Token, assinatura secreta do webhook e Public Key para cartão interno, todos da mesma aplicação/ambiente. |
| PagBank | Token de produção habilitado para Checkout. |
| PicPay | Client ID, Client Secret e token da notificação configurada no painel PicPay. |
| Frete | Chave do openrouteservice e localização real da confeitaria. |
| WhatsApp | Instalar a ponte num computador/servidor sempre ligado, vincular ao painel e ler o QR com o WhatsApp da loja. Não exige credenciais da Meta. |

Os formulários, APIs e fluxos de ativação estão no código. Este ZIP não fornece contas bancárias, credenciais, um servidor ligado para a ponte ou uma sessão WhatsApp já pareada. A aceitação de pagamentos reais e o envio real de mensagens precisam ser conferidos com as contas da confeitaria após a configuração. O site segue funcionando se a ponte ficar offline; a fila indica a situação dos avisos.

A documentação do WhatsApp está em `whatsapp-bridge/INSTALAR.md`. A ponte usa WhatsApp Web e está sujeita a mudanças e restrições da plataforma; não há promessa de sessão permanente ou envio infalível.

## Instalar uma cópia

1. Use Node.js 22.13+ e a versão de pnpm indicada em `package.json`.
2. Execute `pnpm install --frozen-lockfile`.
3. Configure Cloudflare Workers com D1 (`DB`) e R2 (`BUCKET`), ou atualize o mesmo site pelo Sites.
4. Configure `APP_SECRET`, `ADMIN_SETUP_CODE` e `PUBLIC_URL`. Consulte `.env.example`; use segredos novos para uma instalação independente e preserve `APP_SECRET` ao atualizar uma loja já configurada.
5. Aplique as migrações `drizzle/` em ordem, uma única vez. O deploy do Sites administra essas migrações.
6. Execute `pnpm build` e publique pela hospedagem configurada. O projeto inclui os scripts de desenvolvimento; o plugin Sites não está dentro do ZIP.

O identificador de `.openai/hosting.json` pertence ao site atual. Uma cópia independente precisa de identificador, banco e armazenamento próprios. A primeira ativação utiliza a identidade da conta responsável do Sites; em outra hospedagem, configure uma autenticação equivalente antes de expor a ativação.

## Verificação realizada

259 verificações do comércio com SQLite real, hashing real, migrações e transporte de provedores simulado. 9 verificações da ponte WhatsApp. TypeScript e compilação verificados. A navegação das nove áreas e os novos controles foram conferidos com componentes reais e dados fictícios isolados; catálogo e sacola foram conferidos no navegador. Nenhuma cobrança real ou mensagem a clientes foi feita nesses testes.

O teste de impressora física e a ativação com contas reais dependem dos equipamentos e acessos da confeitaria. SEO técnico facilita a descoberta; indexação e posição no Google não são garantidas.

Referências da integração de cartão: [envio pelo Card Payment Brick](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/card-payment-brick/payment-submission) e [3DS](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/how-tos/integrate-3ds).

### Emissão de código de primeiro acesso

Somente o responsável pela hospedagem configura `ADMIN_ACTIVATION_HASH` (SHA-256 do código em letras maiúsculas, sem espaços nem hífens) e `ADMIN_ACTIVATION_EXPIRES` (data limite em milissegundos Unix). Use pelo menos 12 bytes aleatórios para o código. O valor real nunca fica no código-fonte ou no ZIP. O servidor limita tentativas, registra o uso e cria conta e sessão na mesma transação. Essa opção não substitui contas já cadastradas nem altera o vínculo da conta responsável.
