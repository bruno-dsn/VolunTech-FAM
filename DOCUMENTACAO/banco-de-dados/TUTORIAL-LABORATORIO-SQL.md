# Tutorial do Laboratório SQL (roteiro de 5 minutos)

O Laboratório SQL fica no menu lateral, em **Laboratório SQL**. Ele roda consultas de verdade no banco (D1/SQLite) com os dados fictícios da sua sessão. Tudo abaixo já está no botão **Roteiro guiado** da tela: use as setas ‹ › para avançar e o botão **Executar SQL**.

## Antes de começar
1. Entre no painel (senha pública `VolunTech2026!`) e abra **Laboratório SQL**.
2. Clique em **Verificar tudo** uma vez. Deve aparecer **✔ 18 de 18 passos funcionaram**. Isso prova, antes da apresentação, que o banco responde.
3. Se quiser a prova fora da tela, rode no terminal (com o site ligado): `node --experimental-strip-types --no-warnings scripts/test-sql-lab.mjs`

## Os dados iniciais (para você saber o que esperar)
33 voluntários fictícios, 3 ações com 4 + 3 + 5 = 12 participantes, 4 parceiros e 2 lotes de doação (24 kits de higiene, com 8 distribuídos, e 18 livros). Se você cadastrar algo novo, os números mudam.

## Roteiro

### 1. Buscas
| Passo | O que mostrar | Resultado esperado |
|---|---|---|
| Quem está em análise? | `WHERE` e `ORDER BY` | 19 pessoas |
| Música ou cabelo | `LIKE '%musica%' OR ...`, a mesma busca do assistente de voluntários | 16 pessoas |
| Fichas incompletas | Filtrar vazios (`email = ''`) para limpar cadastros | 9 fichas |

**Fala sugerida:** "Toda busca é uma pergunta: quais linhas, de qual tabela, com qual filtro."

### 2. Análises
| Passo | Conceito | Resultado esperado |
|---|---|---|
| Voluntários por área | `GROUP BY` + `COUNT` | 8 áreas |
| Situação × etapa | `GROUP BY` com 2 colunas, parecido com tabela dinâmica | 6 combinações |
| Áreas com 2 ou mais pessoas | `HAVING` | 7 áreas |
| Total de pessoas | `COUNT(*)` | 33 |

**Fala sugerida:** "O `WHERE` filtra linhas antes de contar; o `HAVING` filtra os grupos depois de contar."

### 3. Cruzando tabelas
| Passo | Conceito | Resultado esperado |
|---|---|---|
| Ações com o nome do parceiro | `LEFT JOIN` (a ação guarda só o número do parceiro) | 3 ações |
| Participantes por situação da ação | `SUM` + `GROUP BY` | 3 situações |
| Média de participantes por parceiro | `AVG` + `JOIN` | 3 parceiros, médias 5, 4 e 3 |

**Fala sugerida:** "Os dados ficam em tabelas separadas para não repetir informação. O JOIN junta de volta quando preciso."

### 4. Doações (rastreabilidade)
| Passo | Conceito | Resultado esperado |
|---|---|---|
| Saldo de cada lote | Cálculo no banco: recebido − distribuído | Livros infantis: 18, Kits de higiene: 16 |
| Rastreio: do lote ao destino | `JOIN` entre movimentações e lotes | 3 movimentações |
| Total distribuído por destino | `SUM` com `WHERE kind = 'Saída'` | 8 unidades para "Projeto Acolher (fictício)" |

**Fala sugerida:** "Cada entrada e saída fica registrada, então dá para dizer de onde veio e para onde foi cada item."

### 5. Tente quebrar (segurança)
Peça para o professor sugerir um ataque, ou use os cinco prontos. Todos devem aparecer em verde como **Bloqueado, como esperado ✔**.

| Tentativa | Por que é recusada |
|---|---|
| `DROP TABLE volunteers` | Só `SELECT` é aceito |
| `SELECT ...; DELETE ...` | Ponto e vírgula não é aceito (uma instrução por vez) |
| `... WHERE status = 'x' OR 1=1` | Só se compara uma coluna com um valor |
| `SELECT token FROM staff_sessions` | Tabela fora da lista de permissões |
| `SELECT owner FROM volunteers` | A coluna `owner` (dono da linha) não é legível |

Depois, abra **Ver o SQL que o servidor montou** em qualquer consulta que funcionou e mostre `owner = ?`: é o filtro que isola cada sessão.

## Como explicar a segurança em 20 segundos
"O servidor não repassa o que eu digito. Ele lê a consulta, confere cada tabela e coluna numa lista de permissões, e monta um SQL novo. Os valores vão separados, como parâmetros, e toda consulta ganha o filtro da minha sessão. Por isso ninguém consegue apagar nada nem ver os dados de outra pessoa."

## Escreva as suas
- Liste as colunas (não existe `SELECT *`). O **dicionário de dados** na tela mostra o que está liberado.
- Com `JOIN`, dê um apelido a cada tabela e escreva `apelido.coluna`.
- Cálculos e funções precisam de `AS nome`: `SUM(quantity) AS total`.
- Cruzamentos liberados: `actions.partner_id = partners.id` e `donation_movements.donation_id = donations.id`.
- Limite de 200 linhas por consulta.

## Perguntas que o professor pode fazer
| Pergunta | Resposta curta |
|---|---|
| Isso é SQL de verdade? | Sim, as consultas rodam no SQLite (D1). O servidor só limita o que pode ser executado. |
| Por que não aceita qualquer SQL? | Para ninguém alterar ou ler dados que não deve. Em um sistema real isso viria de perfis de acesso do banco. |
| Como evita injeção de SQL? | O texto digitado nunca entra no SQL: ele é lido, validado e enviado como parâmetro `?`. |
| Dois usuários veem os mesmos dados? | Não. Cada sessão tem o seu `owner`, e o teste automático comprova isso. |
| Existe teste? | `scripts/test-sql-lab.mjs` confere os 18 passos, compara contagens e somas com contas feitas em JavaScript e testa o isolamento entre duas sessões. |
