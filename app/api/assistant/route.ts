import { db, digits, ensureDemo, errorResponse, normalized, session } from "../../../lib/volunteers";
import { forbidden, staffFromRequest } from "../../../lib/auth";

export const dynamic = "force-dynamic";
type Match = { id: number; cpf: string; name: string; niche: string; city: string; status: string; stage: string };

const categories: { key: string; words: string[]; niches?: string[] }[] = [
  { key: "musica", words: ["musica", "musico", "musicos", "cantor", "coral", "violao"] },
  { key: "cabelo", words: ["cabelo", "cabeleireiro", "barbeiro", "barbearia", "beleza", "barba"], niches: ["cabelo", "cabeleireiro", "barbearia", "beleza"] },
  { key: "palhacaria", words: ["palhaco", "palhacos", "palhacaria", "clown"] },
  { key: "historias", words: ["historia", "historias", "contacao", "contador"] },
  { key: "leitura", words: ["leitura", "livros", "ler"] },
  { key: "artesanato", words: ["artesanato", "artesao"] },
  { key: "teatro", words: ["teatro", "ator", "atriz"] },
  { key: "acolhimento", words: ["acolhimento", "acolher"] },
];
const nouns = /\b(quem|pessoas?|voluntari[oa]s?|cadastros?|tipo|tipos|area|atuacao|nicho|faz|fazem|com|que|sao|mostr[ae]|procure|buscar|encontre|quero|de|do|da|em|no|na|os|as|e|ou|quantos?|total)\b/g;

export async function GET(request: Request) {
  const { owner, headers } = session(request);
  try {
    if (!await staffFromRequest(request)) return forbidden(headers);
    await ensureDemo(owner);
    const url = new URL(request.url);
    const question = (url.searchParams.get("q") ?? "").trim().slice(0, 180);
    const offset = Math.min(Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0), 5000);
    if (!question) return Response.json({ reply: "Pergunte por CPF, área, situação ou cadastros incompletos.", total: 0, matches: [], sql: "", params: [], offset: 0 }, { headers });
    const q = normalized(question);
    const cpf = digits(question);
    const clauses: string[] = [];
    const params: string[] = [];
    const labels: string[] = [];
    if (cpf.length === 11) {
      clauses.push("cpf = ?"); params.push(cpf); labels.push("CPF");
    } else {
      if (/incomplet|sem contato|faltando|para conferir/.test(q)) {
        clauses.push("(email = '' OR phone = '' OR city = '')"); labels.push("campos incompletos");
      }
      const status = /em analise|em analise|pendente de analise/.test(q) ? "Em análise" :
        /\binativ[oa]s?\b/.test(q) ? "Inativo" : /\bativ[oa]s?\b/.test(q) ? "Ativo" : "";
      if (status) { clauses.push("status = ?"); params.push(status); labels.push(status.toLowerCase()); }
      const stage = /termo/.test(q) ? "Termo pendente" : /treinamento/.test(q) ? "Treinamento" : /entrevista/.test(q) ? "Entrevista" : "";
      if (stage) { clauses.push("stage = ?"); params.push(stage); labels.push(stage.toLowerCase()); }
      const found = categories.filter((category) => category.words.some((word) => new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(q)));
      if (found.length) {
        const nicheTerms = [...new Set(found.flatMap((item) => item.niches ?? [item.key]))];
        clauses.push(`(${nicheTerms.map(() => "niche_key LIKE ?").join(" OR ")})`);
        params.push(...nicheTerms.map((term) => `%${term}%`));
        labels.push(found.map((item) => item.key === "musica" ? "música" : item.key === "palhacaria" ? "palhaçaria" : item.key === "historias" ? "histórias" : item.key).join(" ou "));
      } else if (!clauses.length && !/\b(quant|resumo|total|numero)\b/.test(q)) {
        const term = q.replace(nouns, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 60);
        if (term) {
          clauses.push("(niche_key LIKE ? OR lower(name) LIKE ? OR lower(city) LIKE ? OR lower(company) LIKE ?)");
          params.push(...Array(4).fill(`%${term}%`));
          labels.push(term);
        }
      }
    }
    const where = `owner = ?${clauses.length ? " AND " + clauses.join(" AND ") : ""}`;
    const sql = `SELECT id, cpf, name, niche, city, status, stage FROM volunteers WHERE ${where} ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?`;
    const countSql = `SELECT COUNT(*) AS total FROM volunteers WHERE ${where}`;
    const totalRow = await db().prepare(countSql).bind(owner, ...params).first<{ total: number }>();
    const total = Number(totalRow?.total ?? 0);
    const result = await db().prepare(sql).bind(owner, ...params, 50, offset).all<Match>();
    const matches = result.results ?? [];
    const descriptor = labels.length ? labels.join(" e ") : "todos os cadastros";
    const reply = cpf.length === 11
      ? total ? `Encontrei ${matches[0]?.name}, da área ${matches[0]?.niche}. Abra a ficha para revisar.` : "Não encontrei esse CPF. Você pode criar um cadastro."
      : total ? `Encontrei ${total} pessoa(s) para ${descriptor}. ${total > 50 ? "Abra a lista e avance pelas páginas." : "Abra a lista para conferir."}`
      : `Não encontrei pessoas para ${descriptor}. Tente outra área ou situação.`;
    return Response.json({
      reply, total, matches, sql, countSql, params: ["sessão atual", ...params, 50, offset],
      offset, nextOffset: offset + 50 < total ? offset + 50 : null,
      category: labels.join(", ") || "geral",
    }, { headers });
  } catch (error) { return errorResponse(error, headers); }
}
