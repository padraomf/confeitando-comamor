# Conectar WhatsApp por QR no painel

Este conector usa **whatsapp-web.js 1.34.7**, com um navegador Chromium e sessão persistente. Ele abre a conta pelo QR exibido no painel e envia os avisos de recebimento, pagamento, preparo, entrega e retirada dos pedidos. Não exige token da Meta.

O site já inclui os controles e a fila. **O conector precisa ser instalado e permanecer rodando em um computador ou servidor com internet.** Ele não roda dentro do Cloudflare Worker usado pela hospedagem Sites. Este ZIP contém o serviço, mas não contrata nem provisiona uma VPS.

## Instalação direta

Requisitos: Node.js 22.13 ou superior, npm e sistema operacional compatível com o Chromium baixado pelo Puppeteer. Deixe a pasta em um local permanente. Não use uma pasta sincronizada entre computadores.

1. Abra um terminal nesta pasta `whatsapp-bridge`.
2. Instale as dependências. O instalador do Puppeteer baixa o navegador necessário:

```sh
npm ci
```

3. No site, abra Painel → Conexões → WhatsApp por QR code → Instalar ou trocar o computador do conector. Clique em **Gerar código de instalação**.
4. Execute o assistente abaixo e cole o código. Pressione Enter para usar o endereço atual da Confeitando com Amor.

```sh
npm run setup
```

5. Inicie o conector e mantenha o terminal aberto:

```sh
npm start
```

6. Volte ao painel e clique em **Conectar WhatsApp**. Aguarde o QR code verdadeiro ser gerado.
7. No celular da confeitaria: WhatsApp → Aparelhos conectados → Conectar aparelho. Leia o QR exibido **dentro do painel**.
8. Aguarde o painel indicar **WhatsApp conectado**. Se já houver uma sessão válida salva, a conexão pode ser restaurada sem um novo QR.
9. Em Minha loja, confira o WhatsApp que receberá os avisos e mantenha os resumos automáticos ativos com a opção `QR code · whatsapp-web.js`.

O código de instalação dura dez minutos e só pode ser usado uma vez. Ele vincula o conector ao site; não é o QR do WhatsApp. A credencial interna gerada pelo assistente fica em `data/config.json`, sem precisar copiar um token de API da Meta.

## Servidor com Docker

O serviço não abre portas para a internet: consulta o site por HTTPS. O exemplo usa um volume permanente para a sessão e o registro de envios.

```sh
docker compose build
docker compose run --rm -it whatsapp node setup.mjs
docker compose up -d
```

Durante o assistente, informe o código gerado no painel. Depois clique em Conectar WhatsApp no painel e leia o QR. Para consultar o serviço:

```sh
docker compose logs --tail=50 whatsapp
```

Para interromper o conector sem apagar a sessão:

```sh
docker compose down
```

Não execute `down -v`: isso remove os dados da sessão e o registro de envios. O contêiner roda como usuário sem privilégios, com capacidades removidas. O Chromium do contêiner usa as flags de compatibilidade sem sandbox indicadas pela biblioteca; mantenha o servidor e a imagem atualizados.

## Funcionamento dos pedidos

- O cliente autoriza o resumo marcando a opção de WhatsApp no checkout. Sem essa autorização, a mensagem automática ao cliente não entra na fila.
- O número de alertas da confeitaria é configurado em Minha loja. Na ausência dele, a fila pode usar o número já informado pela sessão conectada.
- Quando o conector estiver pronto, a fila envia cada resumo com itens, valor, pagamento, endereço e link do ponto exato da entrega.
- Cada mudança do pedido cria um aviso separado, com controle contra duplicação. O texto considera a situação atual para não voltar a uma etapa antiga quando a conexão retornar.
- O estado `enviado` significa que a biblioteca retornou um identificador de mensagem; não confirma leitura nem entrega ao aparelho do destinatário.
- Se o conector ficar offline, pedidos novos aguardam na fila. Resumos com mais de 24 horas e pedidos cancelados antes do envio não são enviados automaticamente.
- O registro local é gravado antes do envio. Uma tentativa incerta não é repetida automaticamente. Confira a conversa e use o atalho manual do pedido se for necessário enviar novamente.
- Apenas uma instância do conector pode trabalhar por vez. Uma segunda instância para de executar quando detecta a primeira.

## Reconectar e trocar o computador

Se aparecer Conector offline, ligue o computador, verifique a internet e execute `npm start` ou reinicie o serviço Docker. Se o WhatsApp desconectar, clique em Conectar WhatsApp e leia o novo QR quando solicitado. Desconectar no painel solicita o encerramento da sessão; o conector precisa estar online para executar essa ação. Se estiver offline, remova o aparelho diretamente no WhatsApp do celular para revogar o acesso imediatamente.

Para trocar de computador, pare o conector anterior e faça o assistente no novo computador com outro código do painel. O vínculo anterior é revogado. Não compartilhe `data/config.json`, `data/session` nem os códigos de instalação. Mantenha uma cópia segura do volume inteiro se precisar preservar a sessão e o registro de envios.

Variáveis opcionais para administração técnica:

- `CCA_BRIDGE_DATA_DIR`: diretório permanente dos dados; padrão `data/` nesta pasta.
- `CCA_CHROME_PATH`: caminho de um Chrome/Chromium já instalado, caso não use o baixado pelo Puppeteer.
- `CCA_CONTAINER=1`: aplica as flags de Chromium para o contêiner fornecido.

## Limites e validação

A integração é não oficial e pode parar com mudanças no WhatsApp ou sofrer restrições da plataforma. [Documentação do whatsapp-web.js](https://wwebjs.dev/guide/) e [persistência LocalAuth](https://wwebjs.dev/guide/creating-your-bot/authentication.html).

O código inclui testes com cliente simulado e SQLite real. A conta da confeitaria ainda precisa ser vinculada pelo QR e validada com um pedido de teste autorizado. Não houve envio real nem autenticação em uma conta de WhatsApp durante a preparação do pacote.

## Testes do conector

```sh
npm test
```

Os testes não abrem o WhatsApp e não enviam mensagens.
