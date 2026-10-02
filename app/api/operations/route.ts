import { forbidden, staffFromRequest } from "../../../lib/auth";
import { ensureOperations, logActivity } from "../../../lib/operations";
import { checkOrigin, db, digits, ensureDemo, errorResponse, session } from "../../../lib/volunteers";

export const dynamic = "force-dynamic";
const clean = (value: unknown, max = 100) => typeof value === "string" ? value.trim().slice(0, max) : "";
const bad = (error: string, headers: Headers, status = 400) => Response.json({ error }, { status, headers });

type Lot = { id: number; item: string; quantity_received: number; quantity_distributed: number };
type Action = { id: number; title: string; status: string; documents: string };

export async function GET(request: Request) {
  const { owner, headers } = session(request);
  try {
    if (!await staffFromRequest(request)) return forbidden(headers);
    await ensureDemo(owner); await ensureOperations(owner);
    const [partners, actions, donations, movements] = await db().batch([
      db().prepare("SELECT id, name, kind, created_at FROM partners WHERE owner = ? ORDER BY name").bind(owner),
      db().prepare("SELECT a.*, p.name AS partner_name FROM actions a LEFT JOIN partners p ON p.id = a.partner_id AND p.owner = a.owner WHERE a.owner = ? ORDER BY a.scheduled_at DESC, a.id DESC LIMIT 500").bind(owner),
      db().prepare("SELECT * FROM donations WHERE owner = ? ORDER BY received_at DESC, id DESC LIMIT 500").bind(owner),
      db().prepare("SELECT m.id, m.donation_id, m.kind, m.quantity, m.destination, m.created_at, d.item, d.unit, d.donor FROM donation_movements m JOIN donations d ON d.id = m.donation_id AND d.owner = m.owner WHERE m.owner = ? ORDER BY m.id DESC LIMIT 100").bind(owner),
    ]);
    return Response.json({ partners: partners.results, actions: actions.results, donations: donations.results, movements: movements.results }, { headers });
  } catch (error) { return errorResponse(error, headers); }
}

export async function POST(request: Request) {
  const { owner, headers } = session(request);
  if (!checkOrigin(request)) return bad("Origem não autorizada.", headers, 403);
  try {
    if (!await staffFromRequest(request)) return forbidden(headers);
    await ensureDemo(owner); await ensureOperations(owner);
    const body = await request.json() as Record<string, unknown>;
    const now = new Date().toISOString();
    if (body.action === "partner") {
      const name = clean(body.name), kind = clean(body.kind, 40);
      if (name.length < 2 || !["Grupo voluntário", "ONG", "Empresa", "Instituição"].includes(kind)) return bad("Preencha nome e tipo do parceiro.", headers);
      await db().prepare("INSERT INTO partners (owner, name, kind, created_at) VALUES (?, ?, ?, ?)").bind(owner, name, kind, now).run();
      await logActivity(owner, "Parceiro", `${name}: cadastrado`);
    } else if (body.action === "create_action") {
      const title = clean(body.title), date = clean(body.scheduled_at, 16), department = clean(body.department, 80), source = clean(body.source_channel, 30);
      const participants = Number(body.participants), partnerId = Number(body.partner_id || 0), cpf = digits(body.volunteer_cpf);
      if (title.length < 3 || !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(date) || !department || !Number.isSafeInteger(participants) || participants < 1 || participants > 500 || !["WhatsApp", "E-mail", "Formulário", "Telefone", "Outro"].includes(source)) return bad("Confira título, data, participantes, área e canal de origem.", headers);
      if (partnerId && !await db().prepare("SELECT 1 FROM partners WHERE owner = ? AND id = ?").bind(owner, partnerId).first()) return bad("Parceiro não encontrado.", headers);
      if (cpf && (cpf.length !== 11 || !await db().prepare("SELECT 1 FROM volunteers WHERE owner = ? AND cpf = ?").bind(owner, cpf).first())) return bad("CPF de voluntário não encontrado nesta sessão.", headers);
      await db().prepare("INSERT INTO actions (owner, title, partner_id, volunteer_cpf, scheduled_at, participants, department, source_channel, documents, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pendente', 'Solicitada', ?, ?, ?)")
        .bind(owner, title, partnerId || null, cpf, date, participants, department, source, clean(body.notes, 240), now, now).run();
      await logActivity(owner, "Ação", `${title}: solicitada para ${date.replace("T", " ")}`);
    } else if (body.action === "documents" || body.action === "advance" || body.action === "cancel") {
      const id = Number(body.id);
      if (!Number.isSafeInteger(id) || id < 1) return bad("Ação inválida.", headers);
      const row = await db().prepare("SELECT id, title, status, documents FROM actions WHERE id = ? AND owner = ?").bind(id, owner).first<Action>();
      if (!row) return bad("Ação não encontrada.", headers, 404);
      if (["Realizada", "Cancelada"].includes(row.status)) return bad("Esta ação já foi encerrada.", headers);
      if (body.action === "documents") {
        const documents = body.documents === "Conferido" ? "Conferido" : body.documents === "Pendente" ? "Pendente" : "";
        if (!documents) return bad("Situação dos documentos inválida.", headers);
        const status = documents === "Pendente" && ["Aprovada", "Agendada"].includes(row.status) ? "Em análise" : row.status;
        await db().prepare("UPDATE actions SET documents = ?, status = ?, updated_at = ? WHERE id = ? AND owner = ?").bind(documents, status, now, id, owner).run();
        await logActivity(owner, "Documentos", `${row.title}: ${documents.toLowerCase()}${status !== row.status ? "; retornou para análise" : ""}`);
      } else {
        const next: Record<string, string> = { "Solicitada": "Em análise", "Em análise": "Aprovada", "Aprovada": "Agendada", "Agendada": "Realizada" };
        const status = body.action === "cancel" ? "Cancelada" : next[row.status];
        if (!status) return bad("Transição de etapa inválida.", headers);
        if (status === "Aprovada" && row.documents !== "Conferido") return bad("Confira os documentos antes da aprovação.", headers);
        await db().prepare("UPDATE actions SET status = ?, updated_at = ? WHERE id = ? AND owner = ? AND status = ?").bind(status, now, id, owner, row.status).run();
        await logActivity(owner, "Ação", `${row.title}: ${status.toLowerCase()}`);
      }
    } else if (body.action === "donation") {
      const donor = clean(body.donor), item = clean(body.item), unit = clean(body.unit, 30), purpose = clean(body.purpose), quantity = Number(body.quantity);
      if (donor.length < 2 || item.length < 2 || !unit || !purpose || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) return bad("Preencha origem, item, quantidade, unidade e finalidade.", headers);
      await db().batch([
        db().prepare("INSERT INTO donations (owner, donor, item, unit, quantity_received, quantity_distributed, purpose, received_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)").bind(owner, donor, item, unit, quantity, purpose, now),
        db().prepare("INSERT INTO donation_movements (owner, donation_id, kind, quantity, destination, created_at) VALUES (?, last_insert_rowid(), 'Entrada', ?, '', ?)").bind(owner, quantity, now),
      ]);
      await logActivity(owner, "Doação", `${donor}: entrada de ${quantity} ${unit} de ${item}`);
    } else if (body.action === "distribute") {
      const id = Number(body.id), quantity = Number(body.quantity), destination = clean(body.destination, 120);
      if (!Number.isSafeInteger(id) || !Number.isSafeInteger(quantity) || quantity < 1 || !destination) return bad("Informe lote, quantidade e destino.", headers);
      const lot = await db().prepare("SELECT id, item, quantity_received, quantity_distributed FROM donations WHERE id = ? AND owner = ?").bind(id, owner).first<Lot>();
      if (!lot || quantity > lot.quantity_received - lot.quantity_distributed) return bad("Quantidade maior que o saldo disponível.", headers);
      const result = await db().batch([
        db().prepare("UPDATE donations SET quantity_distributed = quantity_distributed + ? WHERE id = ? AND owner = ? AND quantity_distributed + ? <= quantity_received").bind(quantity, id, owner, quantity),
        db().prepare("INSERT INTO donation_movements (owner, donation_id, kind, quantity, destination, created_at) SELECT ?, ?, 'Saída', ?, ?, ? WHERE changes() > 0").bind(owner, id, quantity, destination, now),
      ]);
      if (!result[0].meta.changes) return bad("Saldo alterado. Atualize a lista e tente novamente.", headers, 409);
      await logActivity(owner, "Doação", `${lot.item}: saída de ${quantity} para ${destination}`);
    } else return bad("Operação desconhecida.", headers);
    return Response.json({ ok: true }, { headers });
  } catch (error) { return errorResponse(error, headers); }
}
