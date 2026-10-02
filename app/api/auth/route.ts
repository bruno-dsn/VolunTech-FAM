import { authCookie, DEMO_PASSWORD, staffFromRequest } from "../../../lib/auth";
import { checkOrigin, db, errorResponse, session } from "../../../lib/volunteers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try { return Response.json({ staff: await staffFromRequest(request) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  if (!checkOrigin(request)) return Response.json({ error: "Origem não autorizada." }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
    if (name.length < 2 || body.password !== DEMO_PASSWORD) return Response.json({ error: "Confira o nome e a senha de demonstração." }, { status: 401 });
    const token = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
    await db().prepare("INSERT INTO staff_sessions (token, display_name, expires_at, created_at) VALUES (?, ?, ?, ?)")
      .bind(token, name, expiresAt, now.toISOString()).run();
    const { headers } = session(request);
    headers.append("Set-Cookie", authCookie(token, request));
    return Response.json({ staff: { display_name: name, expires_at: expiresAt } }, { headers });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  if (!checkOrigin(request)) return Response.json({ error: "Origem não autorizada." }, { status: 403 });
  try {
    const staff = await staffFromRequest(request);
    if (staff) await db().prepare("DELETE FROM staff_sessions WHERE token = ?").bind(staff.token).run();
    const headers = new Headers({ "Cache-Control": "no-store" });
    headers.append("Set-Cookie", authCookie("", request, 0));
    return Response.json({ ok: true }, { headers });
  } catch (error) { return errorResponse(error); }
}
