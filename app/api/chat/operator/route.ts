import { forbidden, staffFromRequest } from "../../../../lib/auth";
import { checkOrigin, db, errorResponse } from "../../../../lib/volunteers";

export const dynamic = "force-dynamic";

async function state(staffToken: string) {
  const queue = await db().prepare("SELECT id, guest_name, created_at, (SELECT body FROM chat_messages m WHERE m.ticket_id = chat_tickets.id ORDER BY m.id LIMIT 1) AS first_message FROM chat_tickets WHERE status = 'waiting' ORDER BY id LIMIT 30").all();
  const active = await db().prepare("SELECT id, guest_name, claimed_by, created_at FROM chat_tickets WHERE status = 'active' ORDER BY id LIMIT 1").first<{ id: number; guest_name: string; claimed_by: string; created_at: string }>();
  const messages = active ? (await db().prepare("SELECT sender, body, created_at FROM chat_messages WHERE ticket_id = ? ORDER BY id LIMIT 100").bind(active.id).all()).results ?? [] : [];
  const history = await db().prepare("SELECT id, guest_name, updated_at, (SELECT body FROM chat_messages m WHERE m.ticket_id = chat_tickets.id ORDER BY m.id LIMIT 1) AS first_message FROM chat_tickets WHERE status = 'closed' ORDER BY id DESC LIMIT 8").all();
  return { history: history.results ?? [], queue: queue.results ?? [], active: active ? { id: active.id, guest_name: active.guest_name, created_at: active.created_at } : null, mine: active?.claimed_by === staffToken, messages };
}

export async function GET(request: Request) {
  try {
    const staff = await staffFromRequest(request);
    if (!staff) return forbidden();
    return Response.json(await state(staff.token), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  if (!checkOrigin(request)) return Response.json({ error: "Origem não autorizada." }, { status: 403 });
  try {
    const staff = await staffFromRequest(request);
    if (!staff) return forbidden();
    const body = await request.json() as Record<string, unknown>;
    const now = new Date().toISOString();
    if (body.action === "claim") {
      const result = await db().prepare("UPDATE chat_tickets SET status = 'active', claimed_by = ?, updated_at = ? WHERE id = (SELECT id FROM chat_tickets WHERE status = 'waiting' ORDER BY id LIMIT 1) AND status = 'waiting' AND NOT EXISTS (SELECT 1 FROM chat_tickets WHERE status = 'active')").bind(staff.token, now).run();
      if (!result.meta.changes) return Response.json({ error: "Não há atendimento livre. Atualize a fila." }, { status: 409 });
    } else if (body.action === "send") {
      const message = typeof body.message === "string" ? body.message.trim().slice(0, 400) : "";
      const ticket = await db().prepare("SELECT id FROM chat_tickets WHERE status = 'active' AND claimed_by = ? LIMIT 1").bind(staff.token).first<{ id: number }>();
      if (!ticket || message.length < 2) return Response.json({ error: "Abra o próximo atendimento e escreva a resposta." }, { status: 400 });
      await db().prepare("INSERT INTO chat_messages (ticket_id, sender, body, created_at) VALUES (?, 'attendant', ?, ?)").bind(ticket.id, message, now).run();
      await db().prepare("UPDATE chat_tickets SET updated_at = ? WHERE id = ?").bind(now, ticket.id).run();
    } else if (body.action === "close") {
      const result = await db().prepare("UPDATE chat_tickets SET status = 'closed', updated_at = ? WHERE status = 'active' AND claimed_by = ?").bind(now, staff.token).run();
      if (!result.meta.changes) return Response.json({ error: "Você não tem um atendimento aberto." }, { status: 409 });
    } else return Response.json({ error: "Operação inválida." }, { status: 400 });
    return Response.json(await state(staff.token), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
