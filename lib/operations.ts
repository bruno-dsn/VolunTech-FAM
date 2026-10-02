import { db } from "./volunteers";

export function saoPauloDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const demoPartners = [
  ["Coletivo Harmonia", "Grupo voluntário"],
  ["Rede Sorrisos", "ONG"],
  ["Mercado Exemplo", "Empresa"],
  ["Ateliê Cuidar", "Grupo voluntário"],
];

export async function ensureOperations(owner: string) {
  const exists = await db().prepare("SELECT 1 FROM partners WHERE owner = ? LIMIT 1").bind(owner).first();
  if (exists) return;
  const now = new Date().toISOString();
  await db().batch(demoPartners.map(([name, kind]) => db().prepare("INSERT INTO partners (owner, name, kind, created_at) VALUES (?, ?, ?, ?)").bind(owner, name, kind, now)));
  const partners = await db().prepare("SELECT id, name FROM partners WHERE owner = ?").bind(owner).all<{ id: number; name: string }>();
  const id = (name: string) => partners.results?.find((item) => item.name === name)?.id ?? null;
  const today = saoPauloDate();
  const sampleActions: [string, number | null, string, number, string, string, string, string, string][] = [
    ["Música na ala infantil", id("Coletivo Harmonia"), `${today}T15:00`, 4, "Pediatria", "WhatsApp", "Conferido", "Realizada", "Equipe assistencial alinhada; ação fictícia."],
    ["Oficina de histórias", id("Rede Sorrisos"), `${today}T16:30`, 3, "Brinquedoteca", "E-mail", "Pendente", "Em análise", "Confirmar sala e documentação."],
    ["Dia de corte e cuidado", id("Ateliê Cuidar"), `${today}T10:00`, 5, "Humanização", "Formulário", "Conferido", "Aprovada", "Aguardando agenda final."],
  ];
  await db().batch(sampleActions.map(([title, partnerId, scheduledAt, participants, department, sourceChannel, documents, status, notes]) => db().prepare("INSERT INTO actions (owner, title, partner_id, volunteer_cpf, scheduled_at, participants, department, source_channel, documents, status, notes, created_at, updated_at) VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(owner, title, partnerId, scheduledAt, participants, department, sourceChannel, documents, status, notes, now, now)));
  const donationSamples: [string, string, string, number, string][] = [
    ["Mercado Exemplo", "Kits de higiene", "unidades", 24, "Acolhimento"],
    ["Rede Sorrisos", "Livros infantis", "unidades", 18, "Oficina de histórias"],
  ];
  await db().batch(donationSamples.map(([donor, item, unit, quantity, purpose]) => db().prepare("INSERT INTO donations (owner, donor, item, unit, quantity_received, quantity_distributed, purpose, received_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)").bind(owner, donor, item, unit, quantity, purpose, now)));
  const lots = await db().prepare("SELECT id, item, quantity_received FROM donations WHERE owner = ? ORDER BY id DESC LIMIT 2").bind(owner).all<{ id: number; item: string; quantity_received: number }>();
  await db().batch((lots.results ?? []).map((lot) => db().prepare("INSERT INTO donation_movements (owner, donation_id, kind, quantity, destination, created_at) VALUES (?, ?, 'Entrada', ?, '', ?)").bind(owner, lot.id, lot.quantity_received, now)));
  const kits = lots.results?.find((lot) => lot.item === "Kits de higiene");
  if (kits) await db().batch([
    db().prepare("UPDATE donations SET quantity_distributed = 8 WHERE id = ? AND owner = ?").bind(kits.id, owner),
    db().prepare("INSERT INTO donation_movements (owner, donation_id, kind, quantity, destination, created_at) VALUES (?, ?, 'Saída', 8, 'Projeto Acolher (fictício)', ?)").bind(owner, kits.id, now),
  ]);
  await db().prepare("INSERT INTO activity_log (owner, category, detail, created_at) VALUES (?, 'Ação', 'Música na ala infantil: realizada (exemplo)', ?)").bind(owner, now).run();
}

export async function logActivity(owner: string, category: string, detail: string) {
  await db().prepare("INSERT INTO activity_log (owner, category, detail, created_at) VALUES (?, ?, ?, ?)").bind(owner, category, detail, new Date().toISOString()).run();
}
