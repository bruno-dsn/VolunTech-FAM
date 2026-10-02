# MER e DER do VolunTech

![DER do VolunTech](DER-VolunTech.png)

## O que são

- **MER (Modelo Entidade-Relacionamento):** a descrição, em palavras, de quais "coisas" o sistema guarda (entidades), quais informações de cada uma (atributos) e como elas se ligam (relacionamentos).
- **DER (Diagrama Entidade-Relacionamento):** o desenho do MER. Está em `DER-VolunTech.png` (para slides) e `DER-VolunTech.svg` (para ampliar sem perder qualidade).

O diagrama foi feito a partir do código real do banco (`db/schema.ts` e `drizzle/*.sql`). Ele mostra o modelo **lógico**: as 9 tabelas como existem hoje no D1/SQLite.

## Visão geral

O banco tem **9 tabelas**, em quatro grupos:

| Grupo | Tabelas | Para que servem |
|---|---|---|
| Gestão do voluntariado | `volunteers`, `partners`, `actions` | Quem é voluntário, quem são os parceiros e quais ações acontecem |
| Doações | `donations`, `donation_movements` | Cada lote recebido e cada entrada ou saída dele |
| Atendimento (chat) | `chat_tickets`, `chat_messages` | Chamados de visitantes e as mensagens de cada um |
| Apoio | `activity_log`, `staff_sessions` | Histórico de atividades do dia e login da equipe |

## MER: relacionamentos e cardinalidades

Convenção usada: o par **(mínimo, máximo)** ao lado de uma entidade diz quantas vezes **uma ocorrência dela** participa do relacionamento.

| Relacionamento | Lado A | Lado B | Como ler |
|---|---|---|---|
| Parceiro **realiza** Ação | Parceiro (0,N) | Ação (0,1) | Um parceiro pode ter várias ações ou nenhuma. Uma ação tem no máximo um parceiro: o campo `partner_id` aceita vazio. |
| Voluntário **coordena** Ação | Voluntário (0,N) | Ação (0,1) | Responsável opcional. A ligação é feita pelo CPF (`volunteer_cpf`). Nos dados de exemplo o campo fica vazio. |
| Doação (lote) **registra** Movimentação | Doação (1,N) | Movimentação (1,1) | Todo lote nasce com uma movimentação de "Entrada". As saídas vêm depois. Cada movimentação pertence a um único lote. |
| Chamado **contém** Mensagem | Chamado (1,N) | Mensagem (1,1) | Todo chamado nasce junto com a primeira mensagem do visitante. Cada mensagem pertence a um único chamado. |

`activity_log` e `staff_sessions` não se ligam a nenhuma outra tabela.

## Regras de negócio ligadas ao modelo

- **Saldo do lote nunca fica negativo.** A saída só é gravada se `quantidade_distribuída + saída <= quantidade_recebida`. O Laboratório SQL confere isso: o total das saídas registradas é igual ao total distribuído nos lotes.
- **CPF único por sessão.** Existe um índice único em (`owner`, `cpf`). Duas pessoas podem ter o mesmo nome, mas não o mesmo CPF.
- **Ação só avança com documentos conferidos.** Fluxo: Solicitada → Em análise → Aprovada → Agendada → Realizada (ou Cancelada).
- **Isolamento por sessão.** Toda tabela de dados tem a coluna `owner`, e toda consulta filtra por ela.

## Decisões de modelagem (e o que dizer sobre elas)

1. **A coluna `owner` aparece em quase todas as tabelas.** Ela guarda o código da sessão de demonstração e separa os dados de cada pessoa que testa. Não é chave estrangeira. Em um sistema real seria trocada por usuários e perfis de acesso.
2. **Não há `FOREIGN KEY` nem `CHECK` no banco hoje.** As ligações (`partner_id`, `donation_id`, `ticket_id`) são garantidas pelo código da aplicação. Esse ponto está sinalizado no próprio diagrama. É o principal ponto de melhoria do modelo (veja o final).
3. **Redundância controlada.**
   - `niche_key` é a versão sem acento e em minúsculas de `niche`, guardada para a busca ser rápida.
   - `quantity_distributed` em `donations` é um total que poderia ser calculado somando as saídas, mas fica gravado para validar o saldo em um único comando.
4. **Área, situação e etapa são texto livre.** Não há tabelas próprias para esses domínios. Isso simplifica a demonstração, mas permite grafias diferentes.
5. **Datas são texto no formato ISO.** O SQLite não tem tipo de data próprio.
6. **O chamado e a primeira mensagem são gravados em dois comandos seguidos**, não em uma transação única. Em um sistema real, os dois entrariam juntos.

## Ligação com o Laboratório SQL

O Laboratório libera exatamente dois cruzamentos, que correspondem às duas ligações do DER com chave de verdade no código:

| Pergunta | Tabelas | Relacionamento do DER |
|---|---|---|
| Quais ações e com qual parceiro? | `actions` + `partners` | Parceiro realiza Ação |
| De onde veio e para onde foi cada item? | `donation_movements` + `donations` | Doação registra Movimentação |

As demais consultas usam uma tabela só, com `GROUP BY`, `SUM`, `AVG` e `HAVING`. O cruzamento Voluntário–Ação não é liberado: ele depende do CPF, que está vazio nos dados de exemplo.

## Perguntas que o professor pode fazer

| Pergunta | Resposta honesta |
|---|---|
| Onde estão as chaves estrangeiras? | As colunas existem e as ligações valem, mas hoje quem garante é o código, não o banco. Adicionar `FOREIGN KEY` é a melhoria natural. |
| O modelo está normalizado? | Em boa parte sim. Há duas redundâncias de propósito (`niche_key` e `quantity_distributed`). Áreas e situações em texto livre poderiam virar tabelas próprias. |
| Por que `owner` em todas as tabelas? | Para cada pessoa que testa ver só os seus dados. Em produção seria substituído por usuários e permissões. |
| Por que `activity_log` e `staff_sessions` não se ligam a nada? | O log é um histórico por sessão e `staff_sessions` guarda só o login de demonstração. Não precisam de ligação para funcionar. |
| Como o saldo de doação não fica negativo? | A atualização só acontece se couber no saldo, e a movimentação só é gravada se essa atualização funcionou. |

## Evoluções possíveis do modelo (propostas, ainda não feitas)

1. Nova migração com `FOREIGN KEY` (`actions.partner_id`, `donation_movements.donation_id`, `chat_messages.ticket_id`) e `CHECK` (quantidades maiores ou iguais a zero, distribuído menor ou igual ao recebido, situações permitidas).
2. Tabelas de domínio para áreas de atuação, situações e etapas.
3. Tabela de usuários e papéis no lugar de `owner` e da senha pública.
4. Gravar chamado e primeira mensagem na mesma transação.
