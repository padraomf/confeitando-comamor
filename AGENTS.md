# Publicação na Cloudflare

Este projeto é Confeitando com Amor. Publicar somente com `padraomf@gmail.com`, conta `f75b22fb9fda340ca60f51698f494b87`, Worker `confeitando-comamor`.

Usar `node scripts/cloudflare.mjs` no lugar de executar Wrangler diretamente. Esse comando mantém o OAuth deste projeto em `.sites-runtime/cloudflare-gmail`, verifica e-mail e conta antes de operar e não altera o OAuth global.

- `npm run cf:login`: autenticar o Gmail deste projeto.
- `npm run cf:whoami`: conferir a autenticação.
- `npm run build` e depois `npm run cf:deploy`: gerar e publicar a versão.

O OAuth global pode estar em `maciel.felix10@hotmail.com`, usado no Padrão MF. Não substituir esse login global para publicar este site. A conexão do aplicativo Cloudflare no ChatGPT é independente dos perfis do Wrangler.

Credenciais ficam somente nos diretórios ignorados. Nunca versionar tokens ou sessões do WhatsApp. Serviços locais devem seguir a organização de `E:\SERVIDOR\AGENTS.md`, mantendo este projeto em `E:\SERVIDOR\projetos\confeitando-comamor`.
