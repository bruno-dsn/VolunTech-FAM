import { normalized } from "./volunteers";

type Article = { topic: string; keywords: string[]; answer: string };
export const articles: Article[] = [
  { topic: "Barbearia e cabelo", keywords: ["barbearia", "barbeiro", "barba", "cabelo", "cabeleireiro", "beleza", "corte"], answer: "Para uma ação de barbearia ou cabelo, o fluxo proposto é: cadastrar a pessoa ou grupo, registrar a atividade e a data, alinhar a área do hospital, conferir documentos e autorização, agendar e só então realizar. Os documentos e critérios reais devem ser confirmados pela equipe do hospital; esta é uma demonstração." },
  { topic: "Música e apresentações", keywords: ["musica", "musico", "canto", "violao", "coral", "apresentacao"], answer: "Uma proposta de música começa com o cadastro do grupo e da ação. A equipe combina horário, espaço, público e quantidade de participantes com a área assistencial, confere documentos e aprovação e depois agenda. A atividade só acontece após a confirmação do hospital." },
  { topic: "Palhaçaria e histórias", keywords: ["palhaco", "palhacaria", "historia", "contacao", "teatro", "leitura"], answer: "Para palhaçaria ou histórias, cadastre o grupo, descreva a ação, indique data e participantes e aguarde a conferência de documentos e a aprovação do setor. A equipe do hospital define áreas permitidas e regras de acesso." },
  { topic: "Cadastro e etapas", keywords: ["cadastro", "inscricao", "etapa", "voluntario", "participar", "documento", "autorizacao"], answer: "Na demonstração, o cadastro registra nome, CPF de teste, área e contato. A ação segue Solicitada → Em análise → Aprovada → Agendada → Realizada, ou Cancelada. A aprovação depende de documentos conferidos. Essa sequência é uma proposta para validar com a supervisão, não uma regra oficial do hospital." },
  { topic: "Doação de alimentos e itens", keywords: ["alimento", "comida", "roupa", "item", "material", "produto", "doar", "doacao"], answer: "Para oferecer alimentos ou outros itens, informe ao setor o que pretende doar, quantidade, origem e finalidade. Antes de levar qualquer item, confirme com a equipe quais produtos são aceitos, condições, prazo e local de entrega. O sistema registra recebimento e depois a saída com destino e quantidade." },
  { topic: "QR simbólico e Pix", keywords: ["pix", "qr", "qr-code", "dinheiro", "pagamento", "valor"], answer: "O QR do VolunTech é simbólico: ele abre uma mensagem de agradecimento, sem chave Pix, cobrança ou pagamento. Para uma doação financeira real, use apenas canais oficiais informados diretamente pelo hospital." },
  { topic: "Parceiros e instituições", keywords: ["empresa", "ong", "instituicao", "parceiro", "grupo"], answer: "Empresas, ONGs e grupos podem ser registrados como parceiros e ligados a uma ação. A equipe acompanha canal de origem, participantes, área envolvida, documentação, status e histórico em um só lugar. A parceria real depende da avaliação do hospital." },
];

const stop = new Set(["como", "qual", "quais", "para", "fazer", "funciona", "funcionar", "quero", "posso", "pode", "onde", "sobre", "uma", "uns", "dos", "das", "com", "por", "que", "tem", "ser", "sao", "foi", "voluntariado", "hospital"]);

export function answerQuestion(question: string) {
  const q = normalized(question);
  if (/\b(atendente|humano|pessoa real|falar com alguem)\b/.test(q)) return null;
  const words = q.split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !stop.has(word));
  const scored = articles.map((article) => ({ article, score: article.keywords.reduce((sum, keyword) => sum + (words.some((word) => word === keyword || (word.length >= 5 && keyword.startsWith(word))) ? 2 : 0), 0) }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 2 ? { topic: scored[0].article.topic, answer: scored[0].article.answer } : null;
}
