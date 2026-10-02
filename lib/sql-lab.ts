/**
 * Mini-dialeto SQL somente leitura para o Laboratório da turma.
 *
 * Em vez de repassar o texto digitado ao banco, o servidor LÊ a consulta (tokenizador + parser),
 * confere cada tabela e coluna numa lista de permissões e MONTA uma consulta nova, com parâmetros `?`.
 * Nenhum texto digitado entra no SQL final, exceto nomes que já passaram pela lista de permissões
 * ou apelidos validados por expressão regular. Toda tabela consultada é filtrada pela sessão (`owner = ?`).
 *
 * Suporta: SELECT [DISTINCT] colunas | COUNT/SUM/AVG/MIN/MAX | coluna ± coluna AS apelido
 *          FROM tabela [apelido] [LEFT|INNER JOIN tabela apelido ON a.col = b.col]
 *          WHERE (=, !=, <>, <, <=, >, >=, LIKE) com AND/OR · GROUP BY · HAVING · ORDER BY · LIMIT 1–200
 */
type ColType = "text" | "int";

export const sqlSchema: Record<string, Record<string, ColType>> = {
  volunteers: { name: "text", cpf: "text", niche: "text", niche_key: "text", email: "text", phone: "text", company: "text", city: "text", address: "text", availability: "text", status: "text", stage: "text", created_at: "text" },
  partners: { id: "int", name: "text", kind: "text", created_at: "text" },
  actions: { title: "text", partner_id: "int", scheduled_at: "text", participants: "int", department: "text", source_channel: "text", documents: "text", status: "text", notes: "text", created_at: "text" },
  donations: { id: "int", donor: "text", item: "text", unit: "text", quantity_received: "int", quantity_distributed: "int", purpose: "text", received_at: "text" },
  donation_movements: { donation_id: "int", kind: "text", quantity: "int", destination: "text", created_at: "text" },
};

/** Cruzamentos permitidos. A condição ON é montada pelo servidor e sempre inclui `owner` igual nas duas tabelas. */
const joins: [string, string][] = [["actions.partner_id", "partners.id"], ["donation_movements.donation_id", "donations.id"]];

export type SqlPlan = { sql: string; parameters: (string | number)[]; columns: string[]; limit: number };
type Tok = { t: "str" | "num" | "id" | "kw" | "sym"; v: string };
const keywords = new Set(["select", "distinct", "from", "where", "and", "or", "group", "by", "having", "order", "limit", "asc", "desc", "as", "like", "join", "left", "inner", "on", "count", "sum", "avg", "min", "max"]);
const aliasPattern = /^[a-z][a-z0-9_]{0,19}$/;
const fail = (message: string): never => { throw new Error(message); };

function tokenize(text: string): Tok[] {
  const tokens: Tok[] = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    let m: RegExpExecArray | null;
    if ((m = /^\s+/.exec(rest))) { i += m[0].length; continue; }
    if (rest[0] === ";") fail("Use uma única consulta SELECT, sem ponto e vírgula.");
    if (rest.startsWith("--") || rest.startsWith("/*")) fail("Comentários não são permitidos no laboratório.");
    if ((m = /^'([^'\n\r\x00]{0,100})'/.exec(rest))) { tokens.push({ t: "str", v: m[1] }); i += m[0].length; continue; }
    if (rest[0] === "'") fail("Texto entre aspas simples inválido: feche as aspas e use até 100 caracteres.");
    if ((m = /^\d{1,9}(?:\.\d{1,4})?/.exec(rest))) { tokens.push({ t: "num", v: m[0] }); i += m[0].length; continue; }
    if ((m = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(rest))) { const v = m[0].toLowerCase(); tokens.push({ t: keywords.has(v) ? "kw" : "id", v }); i += m[0].length; continue; }
    if ((m = /^(?:>=|<=|<>|!=|[(),.*=<>+-])/.exec(rest))) { tokens.push({ t: "sym", v: m[0] }); i += m[0].length; continue; }
    fail(`Caractere não permitido: ${rest[0]}`);
  }
  return tokens;
}

type Ref = { q?: string; c: string };
type Item =
  | { kind: "col"; ref: Ref; alias?: string }
  | { kind: "expr"; a: Ref; op: "+" | "-"; b: Ref; alias?: string }
  | { kind: "agg"; fn: string; arg: Ref | "*"; alias?: string };
type Cond = { ref: Ref; op: string; value: Tok };

export function planSql(input: string): SqlPlan {
  const text = input.trim();
  if (!text) fail("Digite uma consulta SQL.");
  if (text.length > 1500) fail("Consulta longa demais (máximo de 1500 caracteres).");
  const tokens = tokenize(text);
  let pos = 0;
  const peek = () => tokens[pos];
  const atKw = (v: string) => peek()?.t === "kw" && peek().v === v;
  const atSym = (v: string) => peek()?.t === "sym" && peek().v === v;
  const takeKw = (v: string) => { if (!atKw(v)) return false; pos++; return true; };
  const takeSym = (v: string) => { if (!atSym(v)) return false; pos++; return true; };
  const needKw = (v: string, hint = "") => { if (!takeKw(v)) fail(`Esperava ${v.toUpperCase()}${hint}.`); };
  const needSym = (v: string) => { if (!takeSym(v)) fail(`Esperava "${v}" na consulta.`); };
  const ident = (what: string): string => { const tok = peek(); if (!tok || tok.t !== "id") return fail(`Esperava ${what}.`); pos++; return tok.v; };
  const ref = (): Ref => { const first = ident("o nome de uma coluna"); if (takeSym(".")) return { q: first, c: ident("o nome da coluna depois do ponto") }; return { c: first }; };
  const alias = (): string => { const name = ident("um apelido"); if (!aliasPattern.test(name)) fail("Apelido inválido: use letras minúsculas, números e _."); return name; };

  // ---- SELECT
  needKw("select", " no início");
  const distinct = takeKw("distinct");
  const items: Item[] = [];
  do {
    const tok = peek();
    if (tok?.t === "sym" && tok.v === "*") fail("Liste as colunas desejadas em vez de usar *. Consulte o dicionário de dados.");
    if (tok?.t === "kw" && ["count", "sum", "avg", "min", "max"].includes(tok.v)) {
      pos++; needSym("(");
      let arg: Ref | "*";
      if (takeSym("*")) { if (tok.v !== "count") fail("Somente COUNT aceita *."); arg = "*"; } else arg = ref();
      needSym(")");
      items.push({ kind: "agg", fn: tok.v, arg, alias: takeKw("as") ? alias() : undefined });
      continue;
    }
    const first = ref();
    if (atSym("+") || atSym("-")) {
      const op = peek().v as "+" | "-"; pos++;
      const second = ref();
      items.push({ kind: "expr", a: first, op, b: second, alias: takeKw("as") ? alias() : undefined });
    } else items.push({ kind: "col", ref: first, alias: takeKw("as") ? alias() : undefined });
  } while (takeSym(","));
  if (items.length > 8) fail("Selecione no máximo 8 colunas.");

  // ---- FROM / JOIN
  needKw("from", " depois das colunas");
  const scope = new Map<string, string>(); // apelido (ou nome) -> tabela
  const readTable = (): { table: string; key: string; aliased: boolean } => {
    const table = ident("o nome de uma tabela");
    if (!sqlSchema[table]) fail(`Tabela "${table}" não está disponível. Use: ${Object.keys(sqlSchema).join(", ")}.`);
    const hasAs = takeKw("as");
    const aliased = hasAs || peek()?.t === "id";
    const key = aliased ? alias() : table;
    if (scope.has(key)) fail(`O apelido "${key}" já foi usado.`);
    scope.set(key, table);
    return { table, key, aliased };
  };
  const base = readTable();
  let join: { kind: "LEFT JOIN" | "JOIN"; table: string; key: string; left: Ref; right: Ref } | null = null;
  let joinKind: "LEFT JOIN" | "JOIN" | null = null;
  if (takeKw("left")) { needKw("join"); joinKind = "LEFT JOIN"; } else if (takeKw("inner")) { needKw("join"); joinKind = "JOIN"; } else if (takeKw("join")) joinKind = "JOIN";
  if (joinKind) {
    const second = readTable();
    if (!base.aliased || !second.aliased) fail("Em consultas com JOIN, dê um apelido a cada tabela (ex.: FROM actions a JOIN partners p ON ...).");
    needKw("on", " com a ligação entre as tabelas");
    const left = ref();
    needSym("=");
    join = { kind: joinKind, table: second.table, key: second.key, left, right: ref() };
  }
  const multi = scope.size > 1;
  const prefixed = multi || base.aliased;

  const resolve = (r: Ref) => {
    let key = r.q;
    if (!key) { if (multi) fail(`Em consultas com JOIN, escreva tabela.coluna (ex.: a.${r.c}).`); key = base.key; }
    const table = scope.get(key as string);
    if (!table) return fail(`"${key}" não é uma tabela nem um apelido desta consulta.`);
    const type = sqlSchema[table][r.c];
    if (!type) return fail(`A coluna "${r.c}" não existe em ${table}. Colunas: ${Object.keys(sqlSchema[table]).join(", ")}.`);
    return { key: key as string, table, col: r.c, type, sql: prefixed ? `${key}.${r.c}` : r.c };
  };

  let fromSql = prefixed ? `${base.table} ${base.key}` : base.table;
  if (join) {
    const l = resolve(join.left), r = resolve(join.right);
    const pair = new Set([`${l.table}.${l.col}`, `${r.table}.${r.col}`]);
    const allowed = joins.some(([x, y]) => pair.has(x) && pair.has(y)) && l.key !== r.key;
    if (!allowed) fail("Esse cruzamento não está liberado. Use: actions.partner_id = partners.id ou donation_movements.donation_id = donations.id.");
    fromSql += ` ${join.kind} ${join.table} ${join.key} ON ${l.sql} = ${r.sql} AND ${join.key}.owner = ${base.key}.owner`;
  }

  // ---- WHERE
  const conditions: Cond[] = [];
  const connectors: string[] = [];
  const comparators = ["=", "!=", "<>", "<", "<=", ">", ">="];
  if (takeKw("where")) {
    for (;;) {
      const left = ref();
      const opTok = peek();
      let op = "";
      if (opTok?.t === "sym" && comparators.includes(opTok.v)) { op = opTok.v === "<>" ? "!=" : opTok.v; pos++; }
      else if (takeKw("like")) op = "LIKE";
      else fail("Use uma condição como status = 'Em análise' ou niche_key LIKE '%musica%'.");
      const value = peek();
      if (!value || (value.t !== "str" && value.t !== "num")) fail("Compare a coluna com um texto entre aspas simples ou um número.");
      pos++;
      conditions.push({ ref: left, op, value });
      if (atKw("and") || atKw("or")) { connectors.push(peek().v.toUpperCase()); pos++; } else break;
    }
    if (conditions.length > 10) fail("Use no máximo 10 condições simples.");
  }

  // ---- GROUP BY / HAVING / ORDER BY / LIMIT (leitura)
  const groupRefs: Ref[] = [];
  if (takeKw("group")) { needKw("by"); do groupRefs.push(ref()); while (takeSym(",")); if (groupRefs.length > 2) fail("Agrupe por no máximo 2 colunas."); }
  let having: { name: string; op: string; value: number } | null = null;
  if (takeKw("having")) {
    const name = ident("o apelido de uma coluna calculada");
    const opTok = peek();
    if (!(opTok?.t === "sym" && comparators.includes(opTok.v))) fail("HAVING precisa de uma comparação, como total >= 2.");
    pos++;
    const num = peek();
    if (num?.t !== "num") fail("HAVING compara com um número.");
    pos++;
    having = { name, op: opTok.v === "<>" ? "!=" : opTok.v, value: Number(num.v) };
  }
  let orderRef: Ref | null = null, direction = "ASC";
  if (takeKw("order")) { needKw("by"); orderRef = ref(); if (takeKw("desc")) direction = "DESC"; else takeKw("asc"); }
  let limit = 50;
  if (takeKw("limit")) {
    const n = peek();
    if (n?.t !== "num" || !/^\d{1,3}$/.test(n.v)) fail("LIMIT precisa de um número inteiro.");
    pos++; limit = Number(n.v);
    if (limit < 1 || limit > 200) fail("Use LIMIT entre 1 e 200.");
  }
  if (pos < tokens.length) fail(`Trecho não reconhecido perto de "${tokens[pos].v}". Confira a ordem: SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT.`);

  // ---- Montagem validada
  const hasAgg = items.some((item) => item.kind === "agg");
  const groupCols = groupRefs.map(resolve);
  const groupKeys = new Set(groupCols.map((g) => `${g.key}.${g.col}`));
  if (distinct && (hasAgg || groupCols.length)) fail("DISTINCT não combina com GROUP BY ou funções de agregação.");
  if (groupCols.length && !hasAgg) fail("Com GROUP BY, inclua uma função como COUNT(*) AS total.");
  if (having && !hasAgg) fail("HAVING só funciona com COUNT, SUM, AVG, MIN ou MAX.");

  const outputs: string[] = [];
  const aggAliases = new Set<string>();
  const selectSql = items.map((item) => {
    let sql: string, name: string;
    if (item.kind === "col") {
      const c = resolve(item.ref);
      if (hasAgg && !groupKeys.has(`${c.key}.${c.col}`)) fail(`A coluna "${c.col}" precisa estar no GROUP BY quando há COUNT, SUM, AVG, MIN ou MAX.`);
      sql = c.sql; name = item.alias ?? c.col;
    } else if (item.kind === "expr") {
      if (hasAgg) fail("Cálculos entre colunas não podem ser misturados com agregações nesta versão.");
      const a = resolve(item.a), b = resolve(item.b);
      if (a.type !== "int" || b.type !== "int") fail("Somente colunas numéricas podem ser somadas ou subtraídas.");
      if (!item.alias) fail("Dê um apelido ao cálculo, por exemplo: quantity_received - quantity_distributed AS saldo.");
      sql = `(${a.sql} ${item.op} ${b.sql})`; name = item.alias as string;
    } else {
      if (!item.alias) fail(`Dê um apelido a ${item.fn.toUpperCase()}(...), por exemplo: ${item.fn.toUpperCase()}(...) AS total.`);
      if (item.arg === "*") sql = "COUNT(*)";
      else {
        const c = resolve(item.arg);
        if ((item.fn === "sum" || item.fn === "avg") && c.type !== "int") fail(`${item.fn.toUpperCase()} só funciona em colunas numéricas (ex.: participants, quantity).`);
        sql = item.fn === "avg" ? `ROUND(AVG(${c.sql}), 2)` : `${item.fn.toUpperCase()}(${c.sql})`;
      }
      name = item.alias as string; aggAliases.add(name);
    }
    if (keywords.has(name)) fail(`"${name}" é palavra reservada; escolha outro apelido.`);
    if (outputs.includes(name)) fail(`Duas colunas com o nome "${name}". Use AS para renomear uma delas.`);
    outputs.push(name);
    return `${sql} AS ${name}`;
  });

  const parameters: (string | number)[] = [];
  let whereSql = `${prefixed ? `${base.key}.owner` : "owner"} = ?`;
  if (conditions.length) {
    const parts = conditions.map((cond, index) => {
      const c = resolve(cond.ref);
      if (c.type === "int" && cond.value.t !== "num") fail(`"${c.col}" é numérica: compare com um número, sem aspas.`);
      if (c.type === "text" && cond.value.t !== "str") fail(`"${c.col}" é texto: compare com um valor entre aspas simples.`);
      if (cond.op === "LIKE" && c.type !== "text") fail("LIKE só funciona em colunas de texto.");
      parameters.push(c.type === "int" ? Number(cond.value.v) : cond.value.v);
      return `${index ? `${connectors[index - 1]} ` : ""}${c.sql} ${cond.op} ?`;
    });
    whereSql += ` AND (${parts.join(" ")})`;
  }

  let tail = "";
  if (groupCols.length) tail += ` GROUP BY ${groupCols.map((g) => g.sql).join(", ")}`;
  if (having) {
    if (!aggAliases.has(having.name)) fail(`No HAVING use o apelido de uma agregação do SELECT (${[...aggAliases].join(", ")}).`);
    tail += ` HAVING ${having.name} ${having.op} ?`; parameters.push(having.value);
  }
  if (orderRef) {
    if (hasAgg && !groupCols.length) fail("Uma consulta de total único não precisa de ORDER BY.");
    if (!orderRef.q && outputs.includes(orderRef.c)) tail += ` ORDER BY ${orderRef.c} ${direction}`;
    else {
      const c = resolve(orderRef);
      if (groupCols.length && !groupKeys.has(`${c.key}.${c.col}`)) fail("Em consultas agrupadas, ordene pelo grupo ou por uma coluna calculada do SELECT.");
      tail += ` ORDER BY ${c.sql} ${direction}`;
    }
  }
  const sql = `SELECT ${distinct ? "DISTINCT " : ""}${selectSql.join(", ")} FROM ${fromSql} WHERE ${whereSql}${tail} LIMIT ?`;
  return { sql, parameters, columns: outputs, limit };
}
