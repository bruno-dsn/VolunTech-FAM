import { checkOrigin, db, ensureDemo, errorResponse, session } from "../../../lib/volunteers";
import { planSql } from "../../../lib/sql-lab";
import { ensureOperations } from "../../../lib/operations";
import { forbidden, staffFromRequest } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { owner, headers } = session(request);
  if (!checkOrigin(request)) return Response.json({ error: "Origem inválida." }, { status: 403, headers });
  try {
    if (!await staffFromRequest(request)) return forbidden(headers);
    const body = await request.json() as { query?: unknown };
    if (typeof body.query !== "string") return Response.json({ error: "Digite uma consulta SQL." }, { status: 400, headers });
    let plan: ReturnType<typeof planSql>;
    try { plan = planSql(body.query); }
    catch (error) { return Response.json({ error: (error as Error).message }, { status: 400, headers }); }
    await ensureDemo(owner);
    await ensureOperations(owner); // ações, parceiros e doações de exemplo também precisam existir para as consultas
    const result = await db().prepare(plan.sql).bind(owner, ...plan.parameters, plan.limit).all<Record<string, string | number | null>>();
    return Response.json({ columns: plan.columns, rows: result.results ?? [], sql: plan.sql, params: ["sessão atual", ...plan.parameters, plan.limit] }, { headers });
  } catch (error) { return errorResponse(error, headers); }
}
