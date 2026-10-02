import { env } from "cloudflare:workers";

export type Volunteer = {
  id: number; cpf: string; name: string; email: string; niche: string; niche_key: string;
  company: string; address: string; city: string; phone: string;
  availability: string; status: string; stage: string; created_at: string; updated_at: string;
};
export type VolunteerInput = Omit<Volunteer, "id" | "niche_key" | "created_at" | "updated_at">;
export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 5_000_000;
export function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export function db() {
  if (!env.DB) throw new Error("Banco de dados indisponível");
  return env.DB;
}

export function session(request: Request): { owner: string; headers: Headers } {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.match(/(?:^|;\s*)lacos_demo=([a-f0-9-]{36})(?:;|$)/);
  const owner = match?.[1] ?? crypto.randomUUID();
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (!match) {
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    headers.append("Set-Cookie", `lacos_demo=${owner}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure}`);
  }
  return { owner, headers };
}

export function checkOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function validRealCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  let first = 0;
  for (let i = 0; i < 9; i++) first += Number(cpf[i]) * (10 - i);
  first = (first * 10) % 11;
  if (first === 10) first = 0;
  let second = 0;
  for (let i = 0; i < 10; i++) second += Number(cpf[i]) * (11 - i);
  second = (second * 10) % 11;
  if (second === 10) second = 0;
  return first === Number(cpf[9]) && second === Number(cpf[10]);
}

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export function parseInput(value: unknown): { data?: VolunteerInput; error?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Registro inválido." };
  const row = value as Record<string, unknown>;
  const cpf = digits(row.cpf);
  const phone = digits(row.phone);
  const name = clean(row.name, 100);
  const email = clean(row.email, 120).toLowerCase();
  const niche = clean(row.niche, 60);
  const status = clean(row.status, 20) || "Em análise";
  const stage = clean(row.stage, 32) || "Inscrição";
  if (!/^\d{11}$/.test(cpf)) return { error: "CPF de teste deve ter 11 dígitos." };
  if (validRealCpf(cpf)) return { error: "Use somente CPF fictício inválido nesta demonstração." };
  if (name.length < 2 || !niche) return { error: "Preencha nome e área de atuação." };
  if (email && !/^[^\s@]+@[^\s@]+\.test$/.test(email)) return { error: "Use somente e-mail fictício terminado em .test." };
  if (phone && !/^00\d{8,9}$/.test(phone)) return { error: "Use telefone fictício com DDD 00 (10 ou 11 dígitos)." };
  if (!["Ativo", "Em análise", "Inativo"].includes(status)) return { error: "Situação inválida." };
  if (!["Inscrição", "Entrevista", "Treinamento", "Termo pendente", "Liberado"].includes(stage)) return { error: "Etapa inválida." };
  return { data: {
    cpf, name, email, niche,
    company: clean(row.company, 100),
    address: clean(row.address, 160),
    city: clean(row.city, 80),
    phone, availability: clean(row.availability, 100), status, stage,
  } };
}

export async function list(owner: string): Promise<Volunteer[]> {
  const result = await db().prepare(
    "SELECT id, cpf, name, email, niche, niche_key, company, address, city, phone, availability, status, stage, created_at, updated_at FROM volunteers WHERE owner = ? ORDER BY name COLLATE NOCASE LIMIT 10000"
  ).bind(owner).all<Volunteer>();
  return result.results ?? [];
}

const profiles: [string, string, string, string, string, boolean?][] = [
  ["Ana Luz", "Música", "São Paulo", "Ativo", "Liberado"],
  ["Carlos Sorriso", "Palhaçaria", "São Paulo", "Ativo", "Liberado"],
  ["Beatriz Melo", "Cabelo e beleza", "Campinas", "Em análise", "Entrevista"],
  ["Diego Reis", "Contação de histórias", "Santos", "Em análise", "Inscrição", true],
  ["Marina Alves", "Música", "Campinas", "Em análise", "Treinamento"],
  ["João Viana", "Cabelo e beleza", "São Paulo", "Ativo", "Liberado"],
  ["Lívia Ramos", "Palhaçaria", "Santos", "Em análise", "Entrevista", true],
  ["Rafael Duarte", "Música", "Sorocaba", "Ativo", "Liberado"],
  ["Camila Rocha", "Contação de histórias", "São Paulo", "Em análise", "Termo pendente"],
  ["Pedro Lima", "Cabelo e beleza", "Campinas", "Em análise", "Treinamento", true],
  ["Juliana Prado", "Leitura", "São Paulo", "Ativo", "Liberado"],
  ["Fábio Nunes", "Palhaçaria", "São Paulo", "Em análise", "Inscrição", true],
  ["Bárbara Freitas", "Música", "Santos", "Em análise", "Entrevista"],
  ["André Pires", "Artesanato", "Campinas", "Inativo", "Inscrição"],
  ["Tainá Costa", "Cabelo e beleza", "Sorocaba", "Ativo", "Liberado"],
  ["Gustavo Ribeiro", "Acolhimento", "São Paulo", "Em análise", "Treinamento", true],
  ["Alice Barbosa", "Contação de histórias", "Campinas", "Ativo", "Liberado"],
  ["Henrique Moraes", "Música", "São Paulo", "Em análise", "Termo pendente"],
  ["Nina Carvalho", "Palhaçaria", "Santos", "Ativo", "Liberado"],
  ["Bruno Tavares", "Cabelo e beleza", "São Paulo", "Em análise", "Entrevista"],
  ["Isabela Martins", "Teatro", "Campinas", "Em análise", "Inscrição", true],
  ["Caio Teixeira", "Música", "Sorocaba", "Ativo", "Liberado"],
  ["Sofia Mendes", "Leitura", "Santos", "Em análise", "Treinamento"],
  ["Lucas Azevedo", "Acolhimento", "São Paulo", "Inativo", "Inscrição"],
  ["Helena Dias", "Palhaçaria", "Campinas", "Em análise", "Termo pendente", true],
  ["Daniel Oliveira", "Cabelo e beleza", "Santos", "Ativo", "Liberado"],
  ["Laura Silveira", "Música", "São Paulo", "Em análise", "Entrevista"],
  ["Miguel Fernandes", "Artesanato", "Campinas", "Em análise", "Inscrição", true],
  ["Clara Monteiro", "Contação de histórias", "São Paulo", "Ativo", "Liberado"],
  ["Eduardo Batista", "Palhaçaria", "Sorocaba", "Em análise", "Treinamento"],
  ["Valentina Araújo", "Cabelo e beleza", "São Paulo", "Em análise", "Termo pendente", true],
  ["Thiago Campos", "Música", "Campinas", "Inativo", "Inscrição"],
  ["Marina Alves", "Música", "Campinas", "Em análise", "Entrevista"],
];
const demoRows: VolunteerInput[] = profiles.map(([name, niche, city, status, stage, incomplete], index) => ({
  cpf: String(index + 1).padStart(11, "0"),
  name, niche, city: incomplete && index % 3 === 0 ? "" : city,
  email: incomplete ? "" : `pessoa${index + 1}@exemplo.test`,
  phone: incomplete ? "" : `00${String(119876500 + index).padStart(9, "0")}`,
  company: incomplete ? "" : index % 3 === 0 ? "Coletivo Harmonia" : index % 3 === 1 ? "Grupo Alegria" : "Rede Voluntária",
  address: incomplete ? "" : `Rua Exemplo, ${index + 10}`,
  availability: incomplete ? "" : index % 2 === 0 ? "Quarta à tarde" : "Sábado de manhã",
  status, stage,
}));

export async function ensureDemo(owner: string) {
  const sentinel = demoRows[demoRows.length - 1].cpf;
  const seeded = await db().prepare("SELECT 1 AS found FROM volunteers WHERE owner = ? AND cpf = ?").bind(owner, sentinel).first();
  if (!seeded) {
    // O conjunto inicial é histórico fictício, não novos cadastros do relatório de hoje.
    const now = new Date(Date.now() - 86_400_000).toISOString();
    await db().batch(demoRows.map((row) =>
      db().prepare("INSERT OR IGNORE INTO volunteers (owner, cpf, name, email, niche, niche_key, company, address, city, phone, availability, status, stage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(owner, row.cpf, row.name, row.email, row.niche, normalized(row.niche), row.company, row.address, row.city, row.phone, row.availability, row.status, row.stage, now, now)
    ));
  }
  const missing = await db().prepare("SELECT id, niche FROM volunteers WHERE owner = ? AND niche_key = '' LIMIT 2000").bind(owner).all<{ id: number; niche: string }>();
  const rows = missing.results ?? [];
  for (let index = 0; index < rows.length; index += 100) {
    await db().batch(rows.slice(index, index + 100).map((row) =>
      db().prepare("UPDATE volunteers SET niche_key = ? WHERE id = ? AND owner = ?").bind(normalized(row.niche), row.id, owner)
    ));
  }
}

export function errorResponse(error: unknown, headers?: Headers) {
  console.error("Laços database error", error);
  return Response.json({ error: "Não foi possível acessar os cadastros. Tente novamente em instantes." }, { status: 503, headers });
}
