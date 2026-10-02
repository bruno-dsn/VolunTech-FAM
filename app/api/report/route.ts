import { forbidden, staffFromRequest } from "../../../lib/auth";
import { ensureOperations, saoPauloDate } from "../../../lib/operations";
import { db, ensureDemo, errorResponse, session } from "../../../lib/volunteers";

export const dynamic = "force-dynamic";
type Log = { category: string; detail: string; created_at: string };
type Movement = { kind: string; item: string; donor: string; quantity: number; unit: string; destination: string; created_at: string };
type Signup = { name: string; niche: string; created_at: string };

function safeCsv(value: unknown) {
  const str = String(value ?? "").replace(/[\r\n]+/g, " ");
  const neutralized = /^[=+@\-\t]/.test(str) ? `'${str}` : str;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const { owner, headers } = session(request);
  try {
    if (!await staffFromRequest(request)) return forbidden(headers);
    await ensureDemo(owner); await ensureOperations(owner);
    const date = saoPauloDate();
    const [logResult, movementResult, signupResult] = await db().batch([
      db().prepare("SELECT category, detail, created_at FROM activity_log WHERE owner = ? AND date(created_at, '-3 hours') = ? ORDER BY created_at DESC LIMIT 500").bind(owner, date),
      db().prepare("SELECT m.kind, d.item, d.donor, m.quantity, d.unit, m.destination, m.created_at FROM donation_movements m JOIN donations d ON d.id = m.donation_id AND d.owner = m.owner WHERE m.owner = ? AND date(m.created_at, '-3 hours') = ? ORDER BY m.created_at DESC LIMIT 500").bind(owner, date),
      db().prepare("SELECT name, niche, created_at FROM volunteers WHERE owner = ? AND date(created_at, '-3 hours') = ? AND NOT (CAST(cpf AS INTEGER) BETWEEN 1 AND 33) ORDER BY created_at DESC LIMIT 500").bind(owner, date),
    ]);
    const logs = (logResult.results ?? []) as Log[];
    const movements = (movementResult.results ?? []) as Movement[];
    const signups = (signupResult.results ?? []) as Signup[];
    if (new URL(request.url).searchParams.get("format") === "csv") {
      const lines = [
        ["Categoria", "Horário UTC", "Descrição", "Quantidade", "Unidade", "Destino"],
        ...signups.map((item) => ["Cadastro", item.created_at, `${item.name} · ${item.niche}`, "", "", ""]),
        ...movements.map((item) => [`Doação · ${item.kind}`, item.created_at, `${item.item} · origem: ${item.donor}`, item.quantity, item.unit, item.destination]),
        ...logs.filter((item) => item.category !== "Doação").map((item) => [item.category, item.created_at, item.detail, "", "", ""]),
      ];
      const csv = "\uFEFF" + lines.map((line) => line.map(safeCsv).join(";")).join("\r\n") + "\r\n";
      headers.set("Content-Type", "text/csv; charset=utf-8");
      headers.set("Content-Disposition", `attachment; filename="VolunTech-relatorio-${date}.csv"`);
      return new Response(csv, { headers });
    }
    return Response.json({ date, logs, movements, signups, totals: {
      actions: logs.filter((item) => item.category === "Ação").length,
      received: movements.filter((item) => item.kind === "Entrada").reduce((sum, item) => sum + item.quantity, 0),
      distributed: movements.filter((item) => item.kind === "Saída").reduce((sum, item) => sum + item.quantity, 0),
      signups: signups.length,
    } }, { headers });
  } catch (error) { return errorResponse(error, headers); }
}
