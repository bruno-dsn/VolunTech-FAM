import { answerQuestion } from "../../../lib/knowledge";
import { checkOrigin, db, errorResponse, session } from "../../../lib/volunteers";

export const dynamic = "force-dynamic";
type Ticket = { id: number; guest_name: string; status: string; created_at: string };
const safeMessage = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 400) : "";
const invalidPrivateData = (value: string) => /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value) || /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(value);

async function current(visitor: string) {
  const ticket = await db().prepare("SELECT id, guest_name, status, created_at FROM chat_tickets WHERE visitor = ? AND status != 'closed' ORDER BY id DESC LIMIT 1").bind(visitor).first<Ticket>();
  if (!ticket) return { ticket: null, messages: [], position: 0 };
  const messages = await db().prepare("SELECT sender, body, created_at FROM chat_messages WHERE ticket_id = ? ORDER BY id LIMIT 100").bind(ticket.id).all();
  const position = ticket.status === "waiting" ? Number((await db().prepare("SELECT COUNT(*) AS total FROM chat_tickets WHERE status = 'waiting' AND id <= ?").bind(ticket.id).first<{ total: number }>())?.total ?? 0) : 0;
  return { ticket, messages: messages.results ?? [], position };
}

export async function GET(request: Request) {
  const { owner, headers } = session(request);
  try { return Response.json(await current(owner), { headers }); }
  catch (error) { return errorResponse(error, headers); }
}

export async function POST(request: Request) {
  const { owner, headers } = session(request);
  if (!checkOrigin(request)) return Response.json({ error: "Origem não autorizada." }, { status: 403, headers });
  try {
    const body = await request.json() as Record<string, unknown>;
    const message = safeMessage(body.message), name = safeMessage(body.name).slice(0, 40) || "Visitante";
    const open = await current(owner);
    if (body.action === "close") {
      if (open.ticket) await db().prepare("UPDATE chat_tickets SET status = 'closed', updated_at = ? WHERE id = ? AND visitor = ?").bind(new Date().toISOString(), open.ticket.id, owner).run();
      return Response.json({ ticket: null, messages: [], position: 0 }, { headers });
    }
    if (message.length < 3 || invalidPrivateData(message)) return Response.json({ error: "Escreva uma dúvida sem e-mail, CPF ou dados pessoais." }, { status: 400, headers });
    if (body.action === "ask") {
      const answer = answerQuestion(message);
      if (answer) return Response.json({ ...answer, handoff: false, ...open }, { headers });
      // Se não houver resposta confiável, a pergunta entra automaticamente na fila.
      if (open.ticket) return Response.json({ answer: "Sua conversa já está na fila. Continue por ela.", handoff: true, ...open }, { headers });
      const now = new Date().toISOString();
      const result = await db().prepare("INSERT INTO chat_tickets (visitor, guest_name, status, claimed_by, created_at, updated_at) VALUES (?, ?, 'waiting', '', ?, ?)").bind(owner, name, now, now).run();
      await db().prepare("INSERT INTO chat_messages (ticket_id, sender, body, created_at) VALUES (?, 'visitor', ?, ?)").bind(result.meta.last_row_id, message, now).run();
      return Response.json({ answer: "Não encontrei uma resposta segura. Encaminhei sua pergunta para a fila da equipe de demonstração.", handoff: true, ...await current(owner) }, { headers });
    }
    if (body.action === "send" && open.ticket) {
      const now = new Date().toISOString();
      await db().prepare("INSERT INTO chat_messages (ticket_id, sender, body, created_at) VALUES (?, 'visitor', ?, ?)").bind(open.ticket.id, message, now).run();
      await db().prepare("UPDATE chat_tickets SET updated_at = ? WHERE id = ?").bind(now, open.ticket.id).run();
      return Response.json(await current(owner), { headers });
    }
    return Response.json({ error: "Faça uma pergunta para iniciar a conversa." }, { status: 400, headers });
  } catch (error) { return errorResponse(error, headers); }
}
