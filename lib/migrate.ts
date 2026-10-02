// Cria/atualiza o banco automaticamente.
//
// Por que existe: as tabelas (volunteers, staff_sessions, ...) vem das migracoes em
// /drizzle. Na hospedagem original alguem as aplicava; no app local (Electron) o banco
// nasce VAZIO e o login falhava com "no such table: staff_sessions".
// Aqui aplicamos as migracoes uma unica vez por inicializacao, de forma idempotente.
import m0000 from "../drizzle/0000_living_carlie_cooper.sql?raw";
import m0001 from "../drizzle/0001_purple_runaways.sql?raw";
import m0002 from "../drizzle/0002_bored_dracula.sql?raw";

const MIGRATIONS: { name: string; sql: string }[] = [
  { name: "0000_living_carlie_cooper", sql: m0000 },
  { name: "0001_purple_runaways", sql: m0001 },
  { name: "0002_bored_dracula", sql: m0002 },
];

let ready: Promise<void> | null = null;

export function ensureMigrated(db: D1Database): Promise<void> {
  ready ??= apply(db).catch((error) => {
    ready = null; // permite tentar de novo na proxima requisicao
    throw error;
  });
  return ready;
}

async function apply(db: D1Database) {
  await db
    .prepare("CREATE TABLE IF NOT EXISTS __voluntech_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)")
    .run();
  const done = new Set(
    ((await db.prepare("SELECT name FROM __voluntech_migrations").all<{ name: string }>()).results ?? []).map((row) => row.name),
  );

  for (const migration of MIGRATIONS) {
    if (done.has(migration.name)) continue;
    const statements = migration.sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      try {
        await db.prepare(statement).run();
      } catch (error) {
        // Banco que ja tinha a estrutura (ex.: criado antes deste controle): segue em frente.
        const message = String((error as Error)?.message ?? error);
        if (!/already exists|duplicate column/i.test(message)) throw error;
      }
    }
    await db
      .prepare("INSERT OR IGNORE INTO __voluntech_migrations (name, applied_at) VALUES (?, ?)")
      .bind(migration.name, new Date().toISOString())
      .run();
  }
}
