# VolunTech-FAM

**Sistema acadêmico de gestão de voluntariado desenvolvido para a FAM.**

O VolunTech nasceu de um problema de organização do setor de voluntariado: informações sobre voluntários, ações, parceiros, documentos e doações circulavam por diferentes canais. A proposta do projeto é reunir essas informações em uma experiência única, simples de demonstrar e preparada para evolução.

> **Projeto acadêmico:** os dados apresentados são fictícios. O sistema não deve ser usado com dados reais de hospital.

## Baixar e testar

### 🪟 Windows

<a href="../../releases/latest"><img src="public/windows.svg" alt="Windows" width="22" valign="middle"> <strong>Baixar VolunTech para Windows</strong></a>

Baixe o instalador `.exe`, instale e abra o VolunTech pelo Menu Iniciar ou pela Área de Trabalho.

### 🍎 macOS

<a href="../../releases/latest"><img src="public/apple.svg" alt="Apple" width="22" valign="middle"> <strong>Baixar VolunTech para macOS</strong></a>

Baixe o `.dmg` correspondente ao Mac, abra o arquivo, arraste o VolunTech para **Applications** e abra o aplicativo.

**Para o usuário final não é necessário instalar Node.js, pnpm, VS Code, Electron ou executar comandos.**

## QR Codes (abrir no celular)

Os QR Codes da tela inicial (**Tirar uma dúvida** e **QR de doação simbólica**) são gerados na hora, com o endereço do computador na rede Wi-Fi, e o endereço também aparece escrito embaixo de cada QR.

- O computador e o celular precisam estar **na mesma rede Wi-Fi**.
- Pelo endereço da rede o celular só abre as páginas públicas (`/duvidas`, `/gesto` e o chat do visitante). O login e o painel de gestão continuam só no computador que roda o VolunTech. Isso evita expor a tela de login por engano; não substitui autenticação de verdade.
- Na primeira abertura o Windows ou o macOS pode perguntar se o aplicativo pode receber conexões na rede: escolha **Permitir** (rede privada).
- Redes com "isolamento de clientes" (algumas redes de campus, visitantes e hotéis) impedem o celular de alcançar o computador. Nesse caso use o **hotspot do celular** ou outra rede.
- Se o computador trocar de rede, feche e abra o VolunTech para o QR usar o novo endereço.

Variáveis de ambiente opcionais:

| Variável | Efeito |
| --- | --- |
| `VOLUNTECH_LAN=0` | Mantém o app só neste computador (os QR não são exibidos). |
| `VOLUNTECH_PUBLIC_URL=https://...` | Usa esse endereço nos QR (por exemplo, se o VolunTech estiver hospedado). |
| `VOLUNTECH_PORT=5173` | Porta do servidor interno. |

## Documentação

A documentação para a apresentação fica na pasta [`DOCUMENTACAO`](DOCUMENTACAO/). O documento principal é o PDF:

**`DOCUMENTACAO/VolunTech-Historia-e-Visao-Geral.pdf`**

Ele apresenta a história do projeto, a dor identificada, a solução proposta, as funcionalidades, as tecnologias, a evolução para desktop, a participação da IA no desenvolvimento e os limites acadêmicos da solução.

Sobre o banco de dados, veja [`DOCUMENTACAO/banco-de-dados`](DOCUMENTACAO/banco-de-dados/): o **DER** (diagrama), o **MER** (modelo em texto) e o tutorial do **Laboratório SQL**.

[![DER do VolunTech](DOCUMENTACAO/banco-de-dados/DER-VolunTech.png)](DOCUMENTACAO/banco-de-dados/)

## Código-fonte

Este repositório contém uma única versão do projeto: código-fonte, banco/migrações, interface, Electron, scripts e configuração de distribuição.

Os instaladores `.exe` e `.dmg` são gerados pelo GitHub Actions para os respectivos sistemas operacionais e publicados nas **Releases**. O repositório contém uma única base de código; os launchers locais existem apenas para testar o código-fonte sem depender de uma instalação global de Node.js.

## Tecnologias principais

- React + TypeScript
- Next.js / Vinext
- Electron
- Cloudflare Workers / Miniflare
- D1 / SQLite
- Drizzle ORM
- Vite
- pnpm
- GitHub Actions

## IA no desenvolvimento

Ferramentas de IA foram utilizadas como apoio à engenharia de software: análise do projeto, revisão, correção de problemas, configuração de empacotamento e documentação. As decisões de escopo, validação e apresentação continuam sendo responsabilidade da equipe.

O **RAG não está implementado** nesta versão; permanece como possibilidade de evolução futura.


### Execução do código-fonte

Os launchers de Windows e macOS preparam automaticamente Node.js e pnpm quando necessário. O projeto autoriza explicitamente os scripts nativos necessários ao Electron, incluindo `electron-winstaller`, conforme a política do pnpm 11.

## Nota sobre os launchers

Os launchers `Abrir-VolunTech-Mac.command` e `Abrir-VolunTech-Windows.bat` usam um Node.js local e o pnpm 11.25.0 apenas para preparar o ambiente na primeira execução. A instalação segue o `pnpm-lock.yaml` (`--frozen-lockfile`), o mesmo usado pelo GitHub Actions. O binário do Electron é verificado/preparado explicitamente após a instalação.

### Estrutura do desktop

O Electron inicia um processo de servidor interno separado. O estado gravável do runtime fica fora do código do aplicativo, no diretório de dados do usuário. No empacotamento, a árvore necessária do servidor e as dependências Node são mantidas fora do ASAR para evitar problemas de resolução de módulos e de `cwd` no Windows e no macOS.


## Publicar os instaladores (para quem mantém o repositório)

1. Faça commit/push do projeto no GitHub.
2. Crie uma tag de versão: `git tag v1.0.2 && git push origin v1.0.2`.
3. O GitHub Actions (aba **Actions**) gera o `.exe` (Windows) e os `.dmg` (Mac arm64 e Intel) e publica tudo em **Releases**.
   - Alternativa sem tag: **Actions → Build desktop installers → Run workflow**; os arquivos ficam como *artifacts* da execução.

Avisos que os colegas podem ver na primeira abertura (o projeto não é assinado):
Windows → *Mais informações → Executar assim mesmo*. Mac → botão direito → *Abrir*, ou `xattr -cr /Applications/VolunTech.app`.
Detalhes em `LEIA-ME-WINDOWS.txt` e `LEIA-ME-MAC.txt`.

## Para desenvolvedores

- `pnpm install` e depois `pnpm electron` abre o app em modo desenvolvimento.
- `pnpm dev` sobe só o servidor web (porta `5173`) pelo mesmo `scripts/electron-server.mjs` do aplicativo, então os QR Codes já usam o endereço da rede. Confira em `http://localhost:5173/api/network`: deve aparecer o IP do computador, não `null`.
- `pnpm dist:win` / `pnpm dist:mac` geram os instaladores localmente (cada um no seu sistema operacional).
- Login de demonstração: qualquer nome com 2+ letras e a senha `VolunTech2026!`.
- Logs do app instalado: pasta de dados do usuário, `VolunTech/runtime/app.log`.
- A porta interna é a `5173` (pode ser trocada com a variável `VOLUNTECH_PORT`). Se a porta já estiver em uso, o app avisa em vez de abrir outro programa.

### Verificações antes de publicar

```
pnpm lint
pnpm exec tsc --noEmit
pnpm build
# com o app rodando (pnpm start ou pnpm dev):
node --experimental-strip-types --no-warnings scripts/test-sql-lab.mjs
```

O histórico de correções do empacotamento desktop está em [`CHANGELOG.md`](CHANGELOG.md).
