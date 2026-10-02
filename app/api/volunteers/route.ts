import { checkOrigin, db, digits, ensureDemo, errorResponse, list, MAX_IMPORT_ROWS, normalized, parseInput, session } from "../../../lib/volunteers";
import { forbidden, staffFromRequest } from "../../../lib/auth";
import { logActivity } from "../../../lib/operations";

const editableFields = ["name", "email", "niche", "company", "address", "city", "phone", "availability", "status", "stage"] as const;
type EditableField = typeof editableFields[number];

function suppliedFields(source: unknown): EditableField[] {
  if (!source || typeof source !== "object" || Array.isArray(source)) return [];
  const record = source as Record<string, unknown>;
  const keys = Array.isArray(record.provided_fields) ? record.provided_fields : Object.keys(record);
  return editableFields.filter((field) => keys.includes(field) && typeof record[field] === "string" && record[field].trim() !== "");
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { owner, headers } = session(request);
  try {
    if (!await staffFromRequest(request)) return forbidden(headers);
    await ensureDemo(owner);
    const cpf = new URL(request.url).searchParams.get("cpf");
    if (cpf) {
      const row = await db().prepare("SELECT id, cpf, name, email, niche, niche_key, company, address, city, phone, availability, status, stage, created_at, updated_at FROM volunteers WHERE owner = ? AND cpf = ?")
        .bind(owner, digits(cpf)).first();
      return Response.json({ volunteer: row ?? null }, { headers });
    }
    return Response.json({ volunteers: await list(owner) }, { headers });
  } catch (error) { return errorResponse(error, headers); }
}

export async function POST(request: Request) {
  const { owner, headers } = session(request);
  if (!checkOrigin(request)) return Response.json({ error: "Origem não autorizada." }, { status: 403, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 8_000_000) return Response.json({ error: "Arquivo grande demais." }, { status: 413, headers });
  try {
    if (!await staffFromRequest(request)) return forbidden(headers);
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "import") {
      if (body.mode !== "add" && body.mode !== "merge") return Response.json({ error: "Escolha como importar os cadastros." }, { status: 400, headers });
      if (!Array.isArray(body.records) || body.records.length < 1 || body.records.length > MAX_IMPORT_ROWS) {
        return Response.json({ error: `Importe entre 1 e ${MAX_IMPORT_ROWS.toLocaleString("pt-BR")} registros por arquivo.` }, { status: 400, headers });
      }
      const sourceRecords = body.records as unknown[];
      const parsed = sourceRecords.map(parseInput);
      const invalid = parsed.findIndex((item) => item.error);
      if (invalid >= 0) return Response.json({ error: `Linha ${invalid + 1}: ${parsed[invalid].error}` }, { status: 400, headers });
      const rows = parsed.map((item) => item.data!);
      const unique = new Set(rows.map((item) => item.cpf));
      if (unique.size !== rows.length) return Response.json({ error: "O arquivo contém CPFs repetidos. Corrija antes de importar." }, { status: 400, headers });
      await ensureDemo(owner);
      const existing = new Map((await list(owner)).map((item) => [item.cpf, item]));
      const now = new Date().toISOString();
      let imported = 0, updated = 0, skipped = 0;
      // Validate the whole file first; only explicit, nonempty columns can change an existing row.
      const operations = rows.map((row, index) => {
        const previous = existing.get(row.cpf);
        if (!previous) return { kind: "insert" as const, row };
        if (body.mode === "add") return { kind: "skip" as const };
        const changes = suppliedFields(sourceRecords[index]).filter((field) => previous[field] !== row[field]);
        return changes.length ? { kind: "update" as const, row, previous, changes } : { kind: "skip" as const };
      });
      for (let i = 0; i < operations.length; i += 100) {
        const chunk = operations.slice(i, i + 100);
        skipped += chunk.filter((item) => item.kind === "skip").length;
        const writeOperations = chunk.filter((item) => item.kind !== "skip");
        if (!writeOperations.length) continue;
        const result = await db().batch(writeOperations.map((item) => {
          if (item.kind === "insert") {
            const row = item.row;
            return db().prepare("INSERT OR IGNORE INTO volunteers (owner, cpf, name, email, niche, niche_key, company, address, city, phone, availability, status, stage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
              .bind(owner, row.cpf, row.name, row.email, row.niche, normalized(row.niche), row.company, row.address, row.city, row.phone, row.availability, row.status, row.stage, now, now);
          }
          const changes = item.changes as EditableField[];
          const set = changes.map((field) => `${field} = ?`);
          const values: string[] = changes.map((field) => item.row[field]);
          if (changes.includes("niche")) { set.push("niche_key = ?"); values.push(normalized(item.row.niche)); }
          return db().prepare(`UPDATE volunteers SET ${set.join(", ")}, updated_at = ? WHERE owner = ? AND cpf = ?`)
            .bind(...values, now, owner, item.row.cpf);
        }));
        writeOperations.forEach((item, index) => {
          if (Number(result[index].meta.changes ?? 0)) {
            if (item.kind === "insert") imported++; else updated++;
          } else skipped++;
        });
      }
      await logActivity(owner, "Importação", `${imported} novo(s), ${updated} atualizado(s), ${skipped} sem alteração`);
      return Response.json({ imported, updated, skipped }, { headers });
    }
    const result = parseInput(body);
    if (!result.data) return Response.json({ error: result.error }, { status: 400, headers });
    const row = result.data;
    const now = new Date().toISOString();
    const inserted = await db().prepare("INSERT OR IGNORE INTO volunteers (owner, cpf, name, email, niche, niche_key, company, address, city, phone, availability, status, stage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(owner, row.cpf, row.name, row.email, row.niche, normalized(row.niche), row.company, row.address, row.city, row.phone, row.availability, row.status, row.stage, now, now).run();
    if (!inserted.meta.changes) return Response.json({ error: "Este CPF já está cadastrado." }, { status: 409, headers });
    return Response.json({ ok: true }, { status: 201, headers });
  } catch (error) { return errorResponse(error, headers); }
}

export async function PATCH(request: Request) {
  const { owner, headers } = session(request);
  if (!checkOrigin(request)) return Response.json({ error: "Origem não autorizada." }, { status: 403, headers });
  try {
    if (!await staffFromRequest(request)) return forbidden(headers);
    const body = await request.json() as Record<string, unknown>;
    if (!Number.isSafeInteger(body.id) || Number(body.id) < 1) return Response.json({ error: "Cadastro inválido." }, { status: 400, headers });
    const parsed = parseInput(body);
    if (!parsed.data) return Response.json({ error: parsed.error }, { status: 400, headers });
    const row = parsed.data;
    const result = await db().prepare("UPDATE OR IGNORE volunteers SET cpf = ?, name = ?, email = ?, niche = ?, niche_key = ?, company = ?, address = ?, city = ?, phone = ?, availability = ?, status = ?, stage = ?, updated_at = ? WHERE id = ? AND owner = ?")
      .bind(row.cpf, row.name, row.email, row.niche, normalized(row.niche), row.company, row.address, row.city, row.phone, row.availability, row.status, row.stage, new Date().toISOString(), body.id, owner).run();
    if (!result.meta.changes) return Response.json({ error: "Cadastro não encontrado ou CPF já utilizado." }, { status: 409, headers });
    await logActivity(owner, "Cadastro", `${row.name}: ficha atualizada`);
    return Response.json({ ok: true }, { headers });
  } catch (error) { return errorResponse(error, headers); }
}
