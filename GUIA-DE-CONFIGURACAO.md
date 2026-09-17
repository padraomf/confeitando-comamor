# Guia da Confeitando com Amor

## 1. Produtos, horários e entrega

1. Abra o painel, entre com a conta responsável e conclua a ativação administrativa, caso seja o primeiro uso.
2. Em Produtos, edite os exemplos ou cadastre os produtos reais com foto, nome, descrição, preço e categoria. Somente produtos reais e visíveis aparecem no catálogo público.
3. Em Categorias, adicione os grupos desejados. Para remover um grupo que tenha produtos, primeiro mova esses produtos para outro grupo.
4. Em Minha loja, cadastre o endereço completo, incluindo número, bairro, cidade, UF e CEP. Os campos de links de localização foram removidos.
5. Escolha os dias, horários e fuso. “Seguir dias e horários” abre e fecha automaticamente. “Manter aberta” e “Manter fechada” substituem a agenda. Se o horário final for anterior ao inicial, o expediente termina no dia seguinte.
6. Defina o preparo mínimo/máximo, retirada, taxa inicial, valor por quilômetro e distância máxima.
7. Configure pelo menos uma forma de pagamento antes de abrir.

## 2. Frete de acordo com a rota disponível

O servidor consulta o Google Routes com o endereço da loja e as coordenadas do ponto confirmado pelo cliente, usando rota de carro e consideração de trânsito. Usa a quilometragem da rota recomendada retornada pelo serviço, nunca uma distância em linha reta.

**Frete = taxa inicial + distância da rota em km × valor por km.**

Exemplo: taxa inicial de R$ 5,00 + rota de 5,25 km × R$ 1,50 = R$ 12,88, após arredondamento para centavos.

1. Acesse o [Google Maps Platform](https://console.cloud.google.com/google/maps-apis), crie ou selecione um projeto e configure a cobrança exigida pelo serviço.
2. Habilite Routes API e Geocoding API.
3. Crie uma chave de API e restrinja-a às duas APIs. As consultas são feitas pelo servidor.
4. Em Conexões, cole a chave no cartão de Frete pela rota e salve.
5. Cadastre o endereço completo da loja em Minha loja.
6. No catálogo, preencha o endereço, adicione a localização pelo GPS ou mapa e confirme o ponto de entrega. Consulte o frete e confira os dados retornados. Não é necessário criar uma conta para consultar.

Se não houver uma rota, o endereço estiver além da distância máxima ou o serviço estiver indisponível, o site não inventa um preço. O cliente precisa corrigir o endereço ou selecionar retirada, se habilitada. A cotação dura 15 minutos e fica vinculada ao endereço e à sessão que a solicitou. Mudar o endereço ou o ponto de entrega exige uma nova consulta. Rotas e distâncias podem variar com os dados disponíveis no provedor no momento da consulta.

Referência: [Google Routes — calcular rotas](https://developers.google.com/maps/documentation/routes/compute_route_directions).

## 3. WhatsApp — conexão por QR com whatsapp-web.js

A aba Conexões contém **Conectar WhatsApp**, QR de autenticação, situação da sessão e Desconectar. Os resumos são enviados pela sessão conectada, sem token da Meta. O cliente precisa autorizar o resumo no checkout.

**Antes de gerar o QR real, instale o conector no computador da loja ou em um servidor que permaneça ligado.** A hospedagem atual do site executa um Cloudflare Worker, que não inicia o Chromium exigido pelo whatsapp-web.js. O serviço está incluído na pasta `whatsapp-bridge`; as instruções completas estão em `whatsapp-bridge/INSTALAR.md`, com opções direta e Docker.

1. Instale as dependências do conector.
2. No painel, abra WhatsApp por QR code → Instalar ou trocar o computador do conector e gere um código de instalação.
3. Execute o assistente `npm run setup` na pasta do conector e informe esse código. O vínculo é feito uma vez; não é necessário criar um token da Meta.
4. Execute `npm start` e mantenha o serviço ligado.
5. Clique em Conectar WhatsApp no painel. Leia o QR com o celular em Aparelhos conectados → Conectar aparelho.
6. Aguarde WhatsApp conectado. Ao conectar por esse botão, o envio automático é ativado para novos pedidos. Confira em Minha loja o número de alertas da confeitaria.
7. Faça um pedido autorizado e confira o resumo e a situação dos avisos nos detalhes do pedido.

A sessão e o registro de envios ficam no computador/volume do conector. Ao cair, o serviço tenta recuperar a sessão; se o WhatsApp exigir autenticação, o painel mostra um novo QR. Uma tentativa de envio com resultado incerto não é repetida automaticamente: confira a conversa e use o atalho manual quando necessário. Resumos cancelados antes do envio ou com mais de 24 horas não são enviados automaticamente. Desconectar no painel precisa do conector online para encerrar a sessão; para revogação imediata com o serviço offline, remova o aparelho no WhatsApp do celular.

O QR e os controles são privados do administrador. O código de instalação dura dez minutos e só pode ser usado uma vez. O conector consulta o site por HTTPS; não precisa abrir uma porta pública nem receber login/senha do WhatsApp. Trata-se de uma integração não oficial, sujeita a desconexões e mudanças na plataforma.

Referências: [whatsapp-web.js](https://wwebjs.dev/guide/) e [sessão LocalAuth](https://wwebjs.dev/guide/creating-your-bot/authentication.html).

### Modo simples, sem token

1. Em Conexões → WhatsApp sem token, salve o número da confeitaria com `55 + DDD + número`.
2. Clique em Abrir WhatsApp Web para conectar.
3. No celular, abra Aparelhos conectados → Conectar aparelho e leia o QR code mostrado no próprio WhatsApp Web.
4. No pedido do painel, clique em Abrir resumo no WhatsApp Web. A conversa e o resumo são preparados; confira e clique em Enviar. No celular, use Abrir resumo no WhatsApp do cliente.
5. Ao finalizar uma compra, o cliente também pode clicar em Enviar resumo para a confeitaria e confirmar o envio.
6. Se a sessão sair, conecte novamente pelo QR do WhatsApp Web. Mantenha o painel aberto com o som de novos pedidos ativado para receber alertas locais.

Esse modo não vincula a sessão ao servidor do site e não envia mensagens sozinho. O site não lê suas conversas e não marca um atalho aberto como mensagem enviada.

Referências: [conectar um aparelho com QR](https://faq.whatsapp.com/878854700132604) e [conversa por link](https://faq.whatsapp.com/5913398998672934).

### Modo automático pela API oficial

1. Entre em [Meta for Developers](https://developers.facebook.com/apps/) e crie/selecione um aplicativo empresarial com o produto WhatsApp.
2. Na configuração da API do WhatsApp, adicione e verifique um número remetente. Conclua os requisitos de empresa, permissões e cobrança indicados pela Meta.
3. Para operação contínua, gere um token de usuário do sistema com acesso aos ativos do aplicativo e permissões `whatsapp_business_messaging` e `whatsapp_business_management`. O token temporário de teste pode expirar.
4. Copie o token e o ID do número de telefone — o ID não é o número com DDD — para os campos correspondentes em Conexões.
5. Abra o [gerenciador de modelos](https://business.facebook.com/wa/manage/message-templates/). Crie dois modelos de utilidade em português do Brasil (`pt_BR`), um para a loja e outro para o cliente.
6. Use cinco parâmetros no corpo, nesta ordem: nome do cliente, número do pedido, itens, total e informações de entrega/pagamento. Exemplo:

```text
Pedido de {{1}} · #{{2}}
Itens: {{3}}
Total: {{4}}
{{5}}
```

7. Aguarde a aprovação dos modelos. Copie seus nomes exatos para o painel e salve.
8. Clique em Verificar conexão salva. Essa consulta verifica o acesso ao número; não envia uma mensagem nem comprova que um modelo foi aprovado.
9. Em Minha loja, preencha o telefone que receberá alertas no formato `55 + DDD + número`, usando um número diferente do remetente. Ative os avisos e salve.
10. Faça um pedido de validação autorizado. O cliente precisa marcar o consentimento para receber seu resumo. Confira o resultado dos avisos nos detalhes do pedido.

Se houver falha, verifique token, número, permissões, cobrança e aprovação dos modelos. Atualize a credencial quando necessário. O pedido continua salvo mesmo que o WhatsApp falhe. Se o resultado estiver “incerto”, confira o aplicativo antes de reenviar para evitar duplicações.

Referência: [WhatsApp Business Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/).

## 4. Pagamentos — escolha uma opção

Nenhum login/senha bancário é cadastrado no site. Os botões de conexão por login foram removidos. A loja configura o token de API do seu provedor. O pagamento se destina à conta dessas credenciais, sujeito às tarifas e prazos do provedor.

### Opção A: sem conta conectada — maquininha, Pix por chave e dinheiro

1. Em Minha loja, habilite dinheiro, se desejar.
2. Abra Pix direto com conferência manual.
3. Preencha chave Pix, nome do titular e cidade; salve.
4. O cliente vê a chave, o titular e o código copia e cola. Confira o crédito no aplicativo bancário antes de confirmar o recebimento no pedido.
5. Deixe ativa a opção Aceitar cartão na maquininha quando não houver pagamento online. Sem provedor conectado, o checkout permite Cartão na entrega ou Cartão na retirada.
6. O pedido com maquininha começa como Pagar na entrega. O motoboy deve levar a máquina e conferir a aprovação antes de entregar. Na retirada, use a maquininha da loja.
7. Dinheiro e maquininha podem seguir para preparo antes do recebimento. Depois da cobrança, a confeitaria usa Confirmar recebimento no pedido. Pix direto deve ser conferido antes de iniciar o preparo.

Sem nenhuma chave cadastrada, o site não oferece Pix direto: cadastre a chave real da confeitaria. A criação de um pedido não movimenta dinheiro e nunca marca o pagamento como aprovado sozinha.

Se um provedor online estiver configurado e selecionado, o Pix do checkout utiliza esse provedor e sua confirmação automática. O Pix direto é a alternativa quando o provedor selecionado não está configurado. O site não confirma crédito apenas por um comprovante ou clique do comprador.

### Opção B: Mercado Pago — Pix e cartão automáticos

1. Entre na conta Mercado Pago da confeitaria e abra [Suas integrações](https://www.mercadopago.com.br/developers/panel/app).
2. Crie uma aplicação de pagamento online com Checkout Pro.
3. Complete os requisitos e habilite as credenciais de produção. Copie o Access Token de produção.
4. Nas notificações, selecione Webhooks e o evento Pagamentos. Copie a URL mostrada no painel da loja, terminada em `/api/webhooks/mercadopago`.
5. Copie também a assinatura secreta do webhook.
6. Preencha token e assinatura em Conexões, salve e selecione Mercado Pago em Minha loja.
7. Faça uma transação de validação autorizada. Confira o recebimento na conta e a mudança do pedido para “Pago”. Não considere apenas o redirecionamento de volta ao site como confirmação.

Referências: [Checkout Pro](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/overview) e [notificações Webhooks](https://www.mercadopago.com.br/developers/en/docs/checkout-bricks/additional-content/your-integrations/notifications/webhooks).

### Opção C: PagBank / PagSeguro — Pix e cartão automáticos

1. Acesse a conta da confeitaria e consulte o [guia de Checkout](https://developer.pagbank.com.br/docs/checkout).
2. Habilite o acesso à API de Checkout em produção e conclua as liberações exigidas para a conta.
3. Obtenha o token de produção, cole em Conexões e salve.
4. Selecione PagBank / PagSeguro em Minha loja.
5. O site envia a URL terminada em `/api/webhooks/pagbank` ao criar cada checkout. Mantenha o endereço público HTTPS acessível ao PagBank.
6. Valide uma compra autorizada e confira o crédito e a confirmação no pedido.

Referências: [criar Checkout](https://developer.pagbank.com.br/reference/criar-checkout), [Webhooks](https://developer.pagbank.com.br/reference/webhooks-checkout) e [validar autenticidade](https://developer.pagbank.com.br/reference/confirmar-autenticidade-da-notificacao).

### Como o sistema confere o pagamento

1. O pedido começa como “Aguardando pagamento”.
2. O provedor envia uma notificação ao servidor.
3. O site valida a assinatura e consulta os dados do pagamento diretamente no provedor.
4. A confirmação exige o pedido correspondente, a moeda e o valor correto. Só então o status passa para “Pago”.
5. O painel e a área do cliente consultam a atualização automaticamente.

Cancelar o pedido no painel não realiza estorno. Faça o estorno no ambiente do provedor quando necessário. As credenciais de produção desta versão apontam aos endpoints de produção; testes com tokens sandbox precisam de um ambiente separado configurado para sandbox.

## 5. Área do cliente e compra como convidado

- Para ter histórico acessível em outros dispositivos, crie a conta com nome, e-mail e senha de pelo menos 12 caracteres.
- Guarde o código de recuperação mostrado uma vez após o cadastro. “Esqueci minha senha” usa esse código, sem envio de e-mail.
- Na sacola, marque Comprar como convidado para pular a criação de senha. Informe somente os dados necessários do pedido nas próximas etapas.
- O convidado acompanha a compra no mesmo navegador. Em outro navegador ou depois de limpar os cookies, esse acesso não acompanha automaticamente.
- A conta de cliente não concede acesso ao painel da confeitaria.

## 6. Imprimir duas vias e abrir a localização

1. Abra o pedido em Meus pedidos ou no painel e clique em Imprimir pedido · duas vias.
2. A impressão traz a via do cliente e a via do entregador/loja, separadas por RECORTE AQUI.
3. Escolha papel de 80 mm ou A4 na página; no diálogo de impressão, selecione a impressora e o tamanho correspondente. Também é possível salvar como PDF. Desative cabeçalhos e rodapés do navegador se preferir.
4. As duas vias incluem itens, frete, total, endereço, telefone, forma de pagamento, situação, observações e instrução de cobrança.
5. Em entregas novas, o QR aparece na via do motoboy e abre a rota até as coordenadas confirmadas pelo cliente. O endereço e o complemento também permanecem escritos. O ponto vem do GPS ou da marcação no mapa; a precisão depende do dispositivo e da confirmação do cliente. Não representa rastreamento ao vivo. Pedidos antigos sem coordenadas usam o endereço e trazem a indicação “sem ponto GPS”.
6. Dinheiro: destaque do valor a cobrar, valor entregue pelo cliente e troco a devolver. Cartão na entrega: destaque LEVAR A MAQUININHA. Pago: destaque PAGO · NÃO COBRAR.
7. Pix pendente exige conferência no banco. Não cobre duas vezes se o cliente já transferiu. Pedidos cancelados não devem ser entregues/cobrados. Pagamentos estornados ou contestados pedem conferência com a loja.
8. O status é o consultado no momento da impressão. Se mudar depois, imprima novamente. A via do entregador também tem espaço para registrar recebimento e conferência.

O QR é gerado no próprio servidor, sem enviar o endereço a um gerador de QR externo. Somente quem tem acesso ao pedido pode abrir sua impressão; a nota não expõe CPF e não é documento fiscal. O link do QR contém o destino e abre o Google Maps, sujeito às rotas disponíveis quando escaneado. Ele não recalcula nem altera o frete já contratado.

Referência: [Google Maps URLs — direções](https://developers.google.com/maps/documentation/urls/guide#directions-action).

## 7. Compartilhar um produto com foto

Cada produto real e disponível possui um link `/produto/nome-do-produto--ID`. Os links antigos `/produto/ID` continuam funcionando. O botão Compartilhar usa esse link, com título, preço, descrição e a própria foto cadastrada como imagem de prévia. Os metadados são entregues pelo servidor e não dependem de login ou JavaScript do aplicativo de mensagens.

A exibição e a atualização da miniatura dependem do aplicativo que recebe o link e de seu cache. Produtos pausados, excluídos ou demonstrativos não são publicados nessa página. Ao trocar a foto do produto, um aplicativo pode levar algum tempo para renovar a prévia. Não use links de pedidos privados para divulgar o catálogo.

## 8. Antes de abrir a operação

Cadastre os produtos reais, configure horários/endereço, confirme o ponto de entrega no mapa, instale o conector do WhatsApp se usar os avisos por QR e valide uma entrega conhecida e as formas de pagamento que serão usadas. As verificações automatizadas incluídas no código usam serviços externos simulados e não substituem a validação das contas comerciais da confeitaria.


## 8. Login e senha do painel

1. Acesse `/painel`. Para cadastrar o primeiro login, use **Primeiro acesso ou esqueci minha senha → Entrar com a conta responsável**.
2. Se o painel ainda não foi ativado, use o código exclusivo da loja que você recebeu anteriormente para vincular a conta responsável.
3. Entre em **Acessos** (`/painel/acessos`), informe o nome da pessoa, um login e uma senha com pelo menos 12 caracteres e clique em **Criar login e senha**.
4. Essa pessoa pode entrar diretamente em `/painel` com os dados criados, sem entrar no ChatGPT. Não há senha padrão no ZIP.
5. Os acessos administram pedidos, orçamentos, produtos e configurações. Somente a conta responsável cria/remove logins e redefine senhas esquecidas. Cada pessoa pode trocar a própria senha informando a senha atual.
6. Trocar uma senha ou remover um acesso encerra suas sessões anteriores. Use **Sair** ao terminar em um computador compartilhado. As sessões por senha duram até 12 horas.

## 9. Aviso sonoro e histórico

- No painel, toque em **Ativar som**. Um breve som de caixa registradora confirma a ativação. Use **Testar som** quando quiser conferir o volume do dispositivo.
- O aviso toca quando uma nova compra chega, mesmo que ainda não esteja paga. Atualizar a situação do pedido ou consultar o histórico não dispara um novo aviso.
- Mantenha o painel aberto. Há consultas a cada 15 segundos; o navegador pode atrasá-las em abas em segundo plano ou suspender o áudio quando o dispositivo repousa. Após recarregar, ative o som novamente. Não há aviso com o painel fechado.
- Em **Histórico**, escolha data inicial, data final e/ou etapa. As datas incluem o dia completo no fuso configurado em Minha loja. Use as páginas de resultados para consultar pedidos antigos e abra um pedido para ver os detalhes ou imprimir.

Referência técnica: [restrições e boas práticas de áudio no navegador](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

## 10. Encomendas e fotos

1. No catálogo, abra **Encomendas**. Escolha bolo de 12, 20 ou 30 fatias, docinhos a partir de 100 unidades ou ambos.
2. Informe o nome, telefone com DDD, a data desejada e a descrição. Para docinhos, descreva os tipos e a quantidade de cada um.
3. Se quiser, anexe até três fotos de referência em JPG, PNG ou WebP. Cada original pode ter até 20 MB. A imagem será reduzida e comprimida antes do envio.
4. Ao enviar, guarde o código do orçamento. A solicitação fica em **Meus orçamentos** na página de Encomendas. Sem uma conta, o acompanhamento fica vinculado a este navegador e depende de conservar o cookie de convidado.
5. No painel, abra **Orçamentos** para consultar detalhes e fotos, atualizar a situação e conversar com o cliente pelo WhatsApp. O botão abre a conversa para envio manual.
6. O orçamento não gera pagamento, frete ou reserva automática. A confeitaria confirma os detalhes, disponibilidade e preço com o cliente.

Fotos de referência são privadas: só o cliente que enviou e os administradores da loja podem abri-las. Elas não aparecem no catálogo nem nos links de compartilhamento.

Ao adicionar uma **foto de produto** no painel, o site a ajusta para um quadro de 1200 × 1200 com fundo branco, sem cortar o conteúdo, e comprime em WebP (ou JPEG quando o navegador não exporta WebP). O servidor aceita até 1,5 MB após a otimização. Se a imagem não puder ser aberta ou reduzida, o formulário pede outra foto e preserva os demais campos. Produtos cadastrados anteriormente passam pelo novo padrão quando você troca/envia novamente a foto. As novas imagens públicas usam URLs únicas e cache; referências privadas não usam cache público.

Referência técnica: [conversão de imagens pelo canvas](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob).
