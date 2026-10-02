// Teste automático do Laboratório SQL. Com o site rodando (pnpm dev):
//   node --experimental-strip-types --no-warnings scripts/test-sql-lab.mjs [http://127.0.0.1:5173]
// Entra como atendente de demonstração, roda todos os passos do roteiro e confere resultados conhecidos.
import { steps } from "../lib/sql-tutorial.ts";

const base = process.argv[2] ?? "http://127.0.0.1:5173";
let jar = new Map();
async function call(path, body) {
  const response = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") }, body: JSON.stringify(body) });
  for (const header of response.headers.getSetCookie?.() ?? []) { const [pair] = header.split(";"); const i = pair.indexOf("="); jar.set(pair.slice(0, i), pair.slice(i + 1)); }
  return { status: response.status, data: await response.json() };
}
let failures = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "✔" : "✘"} ${name}${detail ? ` — ${detail}` : ""}`); if (!ok) failures++; };
const sql = async (query) => (await call("/api/sql", { query }));

const login = await call("/api/auth", { name: "Teste", password: "VolunTech2026!" });
if (login.status !== 200) { console.error("Não consegui entrar:", login.data); process.exit(1); }

console.log("\n== Roteiro (cada passo) ==");
for (const step of steps) {
  const { status, data } = await sql(step.query);
  if (step.blocked) check(`[${step.level}] ${step.title}`, status === 400 && !!data.error, `HTTP ${status}: ${data.error ?? "sem erro"}`);
  else check(`[${step.level}] ${step.title}`, status === 200 && data.rows?.length > 0, `${data.rows?.length ?? 0} linha(s)`);
}

console.log("\n== Conferência de números (calculados em JS, fora do SQL) ==");
const rowsOf = async (q) => (await sql(q)).data.rows ?? [];
const vols = await rowsOf("SELECT name, niche, status, stage, email, phone, city, niche_key FROM volunteers LIMIT 200");
const count = (await rowsOf("SELECT COUNT(*) AS total FROM volunteers"))[0]?.total;
check("COUNT(*) bate com a lista completa", count === vols.length, `${count} = ${vols.length}`);

const porArea = await rowsOf("SELECT niche, COUNT(*) AS total FROM volunteers GROUP BY niche LIMIT 200");
const jsArea = {}; for (const v of vols) jsArea[v.niche] = (jsArea[v.niche] ?? 0) + 1;
check("GROUP BY niche bate com a contagem em JS", porArea.length === Object.keys(jsArea).length && porArea.every((r) => jsArea[r.niche] === r.total), `${porArea.length} áreas`);
check("A soma dos grupos é o total", porArea.reduce((a, r) => a + r.total, 0) === count);

const having = await rowsOf("SELECT niche, COUNT(*) AS total FROM volunteers GROUP BY niche HAVING total >= 2 LIMIT 200");
check("HAVING total >= 2 bate com JS", having.length === Object.values(jsArea).filter((n) => n >= 2).length, `${having.length} áreas`);

const analise = await rowsOf("SELECT name FROM volunteers WHERE status = 'Em análise' LIMIT 200");
check("WHERE status = 'Em análise' bate com JS", analise.length === vols.filter((v) => v.status === "Em análise").length, `${analise.length} pessoas`);

const musicaOuCabelo = await rowsOf("SELECT name FROM volunteers WHERE niche_key LIKE '%musica%' OR niche_key LIKE '%cabelo%' LIMIT 200");
check("LIKE ... OR LIKE bate com JS", musicaOuCabelo.length === vols.filter((v) => /musica|cabelo/.test(v.niche_key)).length, `${musicaOuCabelo.length} pessoas`);

const incompletas = await rowsOf("SELECT name FROM volunteers WHERE email = '' OR phone = '' OR city = '' LIMIT 200");
check("Fichas incompletas bate com JS", incompletas.length === vols.filter((v) => !v.email || !v.phone || !v.city).length, `${incompletas.length} fichas`);

const acoes = await rowsOf("SELECT status, participants FROM actions LIMIT 200");
const somaJs = acoes.reduce((a, r) => a + r.participants, 0);
const somaSql = (await rowsOf("SELECT SUM(participants) AS s FROM actions"))[0]?.s;
check("SUM(participants) bate com JS", somaSql === somaJs, `${somaSql} = ${somaJs}`);
const media = (await rowsOf("SELECT AVG(participants) AS m FROM actions"))[0]?.m;
check("AVG(participants) bate com JS", Math.abs(media - somaJs / acoes.length) < 0.01, `${media} ≈ ${(somaJs / acoes.length).toFixed(2)}`);

const join = await rowsOf("SELECT a.title, p.name AS parceiro FROM actions a LEFT JOIN partners p ON p.id = a.partner_id LIMIT 200");
check("LEFT JOIN mantém todas as ações e traz o parceiro", join.length === acoes.length && join.every((r) => r.parceiro), `${join.length} ações, todas com parceiro`);

const lotes = await rowsOf("SELECT item, quantity_received - quantity_distributed AS saldo FROM donations LIMIT 200");
const rawLotes = await rowsOf("SELECT item, quantity_received, quantity_distributed FROM donations LIMIT 200");
check("Saldo = recebido − distribuído", lotes.length === rawLotes.length && lotes.every((l) => l.saldo === rawLotes.find((r) => r.item === l.item).quantity_received - rawLotes.find((r) => r.item === l.item).quantity_distributed));
check("Nenhum saldo negativo", lotes.every((l) => l.saldo >= 0));

const saidas = await rowsOf("SELECT SUM(quantity) AS t FROM donation_movements WHERE kind = 'Saída'");
const distribuido = rawLotes.reduce((a, r) => a + r.quantity_distributed, 0);
check("Saídas registradas = total distribuído nos lotes", saidas[0]?.t === distribuido, `${saidas[0]?.t} = ${distribuido}`);

console.log("\n== Segurança extra ==");
for (const [name, q] of [
  ["JOIN não liberado", "SELECT a.title FROM actions a JOIN partners p ON p.name = a.title"],
  ["Tabela de chat", "SELECT body FROM chat_messages"],
  ["Subconsulta", "SELECT name FROM volunteers WHERE name = (SELECT token FROM staff_sessions)"],
  ["UNION", "SELECT name FROM volunteers UNION SELECT token FROM staff_sessions"],
  ["Comentário", "SELECT name FROM volunteers -- x"],
  ["Aspas escapadas", "SELECT name FROM volunteers WHERE status = 'a'' OR ''1''=''1'"],
  ["Função perigosa", "SELECT load_extension('x') FROM volunteers"],
  ["PRAGMA", "PRAGMA table_info(volunteers)"],
  ["LIMIT enorme", "SELECT name FROM volunteers LIMIT 99999"],
]) { const { status } = await sql(q); check(name, status === 400, `HTTP ${status}`); }

console.log("\n== Isolamento entre sessões ==");
const nomeUnico = `Isolamento ${Date.now()}`;
let criado = { status: 0 };
for (let tentativa = 0; tentativa < 8 && criado.status !== 201; tentativa++) { // CPF fictício novo (alguns números por acaso seriam válidos e são recusados)
  const cpf = `0000${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
  criado = await call("/api/volunteers", { cpf, name: nomeUnico, niche: "Teste", status: "Em análise", stage: "Inscrição" });
}
check("Sessão A cadastra uma pessoa nova", criado.status === 201, `HTTP ${criado.status}`);
const contaA = (await sql(`SELECT COUNT(*) AS total FROM volunteers WHERE name = '${nomeUnico}'`)).data.rows?.[0]?.total;
check("Sessão A enxerga a pessoa nova pelo SQL", contaA === 1, `${contaA} resultado(s)`);
jar = new Map();
await call("/api/auth", { name: "Outra pessoa", password: "VolunTech2026!" });
const contaB = (await sql(`SELECT COUNT(*) AS total FROM volunteers WHERE name = '${nomeUnico}'`)).data.rows?.[0]?.total;
check("Sessão B NÃO enxerga a pessoa da sessão A", contaB === 0, `${contaB} resultado(s)`);
const totalB = (await sql("SELECT COUNT(*) AS total FROM volunteers")).data.rows?.[0]?.total;
check("Sessão B continua com as fichas iniciais", totalB === 33, `${totalB} fichas`);

console.log("\n== Sem login ==");
jar.clear();
const anon = await sql("SELECT COUNT(*) AS total FROM volunteers");
check("Sem sessão de atendente a API recusa", anon.status === 401, `HTTP ${anon.status}`);

console.log(failures ? `\n✘ ${failures} verificação(ões) falharam.` : "\n✔ Tudo certo: o Laboratório SQL passou em todas as verificações.");
process.exit(failures ? 1 : 0);
