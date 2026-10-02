# Changelog

## 1.0.2

- Corrigido o QR Code vazio (placeholder "Sem rede") ao iniciar com `pnpm dev`: o script `dev` rodava `scripts/run-framework.mjs` direto e pulava `scripts/electron-server.mjs`, que detecta o IP da rede e o informa ao app. Agora `pnpm dev` executa `node scripts/electron-server.mjs dev`, e `/api/network` devolve o endereço da rede (por exemplo `{"base":"http://192.168.0.10:5173"}`) em vez de `{"base":null}`. O app instalado e os launchers já passavam por esse script.
- `OperationsPanel.tsx` e `OperatorPanel.tsx` apontavam para `/qr-gesto.svg` e `/qr-duvidas.svg`, que já tinham sido removidos de `public/` (imagens quebradas). Passam a usar o componente `ShareQr`, que gera o QR na hora com o endereço da rede.
- `ShareQr` ganhou a classe `share-qr` e o CSS correspondente em `app/globals.css`, para o SVG gerado pelo `uqr` (que traz `viewBox`, mas não `width`/`height`) ter tamanho fixo e visível.
- `.gitignore` passa a ignorar `*.save` e `__MACOSX/`. O resíduo `package.json.save` foi removido do pacote.
- README: o exemplo de tag de release passa a ser `v1.0.2`.

## Correções do empacotamento desktop (histórico)

- `main.js` não usa mais `await` no nível superior: em ESM isso impede o evento `ready` do Electron e o app ficava só pulando no Dock, sem janela.
- O modo produção agora inicia o CLI real do Wrangler como processo filho (o `bin/wrangler.js` não inicia quando importado), na porta 5173, com um preload que corrige o parsing de argumentos do `yargs` dentro do Electron.
- `wrangler` foi movido para `dependencies`, porque o electron-builder remove `devDependencies` do pacote e o servidor precisa dele em execução.
- Adicionada tela de carregamento enquanto o servidor interno inicia.
- Corrigido o login que não carregava os dados: o banco local nascia vazio (`no such table: staff_sessions`). Agora `lib/migrate.ts` aplica as migrações de `drizzle/` automaticamente na primeira requisição, de forma idempotente, e é chamado em `build/sites-worker.ts`. Se criar uma nova migração com `pnpm db:generate`, registre o arquivo `.sql` em `lib/migrate.ts`.

## Revisão de publicação

- Workflow e launchers passam a usar `--frozen-lockfile`; `pnpm-lock.yaml` regenerado e enxuto.
- `VOLUNTECH_PORT` agora vale também para o Electron (`main.js`), com aviso se a porta estiver ocupada.
- Corrigidos erros de `tsc` (tipos de `*.sql?raw`, leitura de `r2` em `vite.config.ts`) e de `eslint` (`Welcome.tsx`).
- Removidos `app/chatgpt-auth.ts`, scripts de instalação de outro ambiente e 16 dependências não utilizadas.
- Removido o nome da supervisora do código e da tela "Sobre".
- QR Codes deixam de apontar para o site antigo (`chatgpt.site`): agora são gerados na hora com o endereço do computador na rede local (`uqr`), ou com `VOLUNTECH_PUBLIC_URL`. Novo componente `ShareQr`, rota `/api/network` e detecção de IP em `scripts/electron-server.mjs`.
- Pelo endereço da rede só abrem `/duvidas`, `/gesto` e `/api/chat`; login e gestão ficam restritos ao computador local. `VOLUNTECH_LAN=0` desliga o compartilhamento.
- Removidos `public/qr-duvidas.svg` e `public/qr-gesto.svg` (QR fixos, com endereço antigo).
