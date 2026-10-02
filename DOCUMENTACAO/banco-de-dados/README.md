# Banco de dados do VolunTech

O banco (D1/SQLite) tem **9 tabelas**. Esta pasta mostra como elas se organizam e como consultá-las.

![DER do VolunTech](DER-VolunTech.png)

*DER lógico do VolunTech, feito a partir de `db/schema.ts` e das migrações em `drizzle/`.*

| Arquivo | O que é |
|---|---|
| [MER-e-DER-VolunTech.md](MER-e-DER-VolunTech.md) | O modelo em texto: entidades, relacionamentos e cardinalidades, regras de negócio, decisões de modelagem e perguntas prováveis do professor. |
| [TUTORIAL-LABORATORIO-SQL.md](TUTORIAL-LABORATORIO-SQL.md) | Roteiro de 5 minutos para apresentar o Laboratório SQL, com o resultado esperado de cada passo. |
| [DER-VolunTech.svg](DER-VolunTech.svg) | O mesmo diagrama em SVG, que pode ser ampliado sem perder qualidade. |
| [DER-VolunTech.png](DER-VolunTech.png) | O diagrama em imagem, para usar em slides. |

## Onde está no código

- Esquema das tabelas: [`db/schema.ts`](../../db/schema.ts) e migrações em [`drizzle/`](../../drizzle/).
- Motor do Laboratório SQL: [`lib/sql-lab.ts`](../../lib/sql-lab.ts) e roteiro em [`lib/sql-tutorial.ts`](../../lib/sql-tutorial.ts).
- Teste automático do laboratório: [`scripts/test-sql-lab.mjs`](../../scripts/test-sql-lab.mjs).
