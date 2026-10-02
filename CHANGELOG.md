# Changelog

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
