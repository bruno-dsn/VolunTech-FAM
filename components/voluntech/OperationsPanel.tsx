"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, CalendarDays, ClipboardCheck, Gift, Plus, UsersRound } from "lucide-react";
import Image from "next/image";

export type OperationsView = "overview" | "actions" | "partners" | "donations" | "report";
type Partner = { id: number; name: string; kind: string };
type Action = { id: number; title: string; partner_name: string | null; volunteer_cpf: string; scheduled_at: string; participants: number; department: string; source_channel: string; documents: string; status: string; notes: string };
type Donation = { id: number; donor: string; item: string; unit: string; quantity_received: number; quantity_distributed: number; purpose: string; received_at: string };
type Movement = { id: number; kind: string; quantity: number; destination: string; created_at: string; item: string; unit: string; donor: string };
type Data = { partners: Partner[]; actions: Action[]; donations: Donation[]; movements: Movement[] };
type Report = { date: string; totals: { actions: number; received: number; distributed: number; signups: number }; logs: { category: string; detail: string; created_at: string }[]; movements: Movement[]; signups: { name: string; niche: string }[] };
const initial: Data = { partners: [], actions: [], donations: [], movements: [] };
const next: Record<string, string> = { "Solicitada": "Em análise", "Em análise": "Aprovada", "Aprovada": "Agendada", "Agendada": "Realizada" };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar. Tente novamente.");
  return body;
}

function formatDate(date: string) {
  if (!date) return "—";
  if (!date.endsWith("Z")) return date.replace("T", " ").slice(0, 16);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(date));
}

export default function OperationsPanel({ view }: { view: OperationsView }) {
  const [data, setData] = useState<Data>(initial);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [distribution, setDistribution] = useState<Record<number, { quantity: string; destination: string }>>({});
  const reload = useCallback(async () => {
    const records = await request<Data>("/api/operations");
    const daily = await request<Report>("/api/report");
    setData(records); setReport(daily);
  }, []);
  useEffect(() => {
    let live = true;
    void request<Data>("/api/operations").then(async (records) => ({ records, daily: await request<Report>("/api/report") }))
      .then(({ records, daily }) => { if (live) { setData(records); setReport(daily); } })
      .catch((reason) => { if (live) setError((reason as Error).message); });
    return () => { live = false; };
  }, [view]);
  async function mutate(payload: Record<string, unknown>, message: string, form?: HTMLFormElement) {
    setBusy(true); setError(""); setSuccess("");
    try {
      await request("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      form?.reset(); setSuccess(message); await reload();
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  const title = { overview: "Visão do setor", actions: "Ações e agenda", partners: "Instituições e parceiros", donations: "Doações", report: "Atualizações de hoje" }[view];
  return <div className="secondary-page operations-page">
    <p className="eyebrow">VOLUNTECH · GESTÃO INTEGRADA</p><div className="page-heading"><div><h1>{title}</h1><p className="subline">Uma demonstração com dados fictícios para acompanhar pessoas, ações, parceiros e doações.</p></div>{view === "report" && <a className="button primary" href="/api/report?format=csv" download><ArrowDownToLine size={18} /> Baixar relatório do dia</a>}</div>
    {error && <p className="ops-feedback error" role="alert">{error}</p>}{success && <p className="ops-feedback" role="status">{success}</p>}
    {view === "overview" && <>
      <div className="ops-metrics"><div><CalendarDays size={22} /><span>Ações em andamento</span><strong>{data.actions.filter((item) => !["Realizada", "Cancelada"].includes(item.status)).length}</strong></div><div><ClipboardCheck size={22} /><span>Documentos pendentes</span><strong>{data.actions.filter((item) => item.documents === "Pendente" && !["Realizada", "Cancelada"].includes(item.status)).length}</strong></div><div><Gift size={22} /><span>Itens disponíveis</span><strong>{data.donations.reduce((sum, item) => sum + item.quantity_received - item.quantity_distributed, 0)}</strong></div><div><UsersRound size={22} /><span>Parceiros cadastrados</span><strong>{data.partners.length}</strong></div></div>
      <div className="ops-columns"><section className="card ops-card"><h2>Próximas decisões</h2>{data.actions.filter((item) => !["Realizada", "Cancelada"].includes(item.status)).slice(0, 5).map((item) => <div className="compact-row" key={item.id}><strong>{item.title}</strong><small>{formatDate(item.scheduled_at)} · {item.department}</small>{report && item.scheduled_at.slice(0, 10) <= report.date && (item.documents === "Pendente" || ["Solicitada", "Em análise"].includes(item.status)) && <small className="attention-note">Atenção: data próxima e conferência pendente</small>}<span className="count-pill">{item.status}</span></div>)}</section><section className="card ops-card"><h2>Resumo do dia · {report?.date ?? "—"}</h2><p>{report?.totals.actions ?? 0} atualização(ões) de ações · {report?.totals.signups ?? 0} cadastro(s) novo(s).</p><p>Entradas: {report?.totals.received ?? 0} item(ns) · saídas: {report?.totals.distributed ?? 0} item(ns). Unidades diferentes são detalhadas no relatório.</p><a className="button outline" href="/api/report?format=csv" download><ArrowDownToLine size={17} /> Baixar relatório do dia</a></section></div>
    </>}
    {view === "partners" && <div className="ops-columns"><section className="card ops-card"><h2>Parceiros</h2>{data.partners.map((partner) => <div className="compact-row" key={partner.id}><strong>{partner.name}</strong><small>{partner.kind}</small></div>)}</section><form className="card ops-card ops-form" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); void mutate({ action: "partner", name: values.get("name"), kind: values.get("kind") }, "Parceiro registrado.", form); }}><h2>Adicionar parceiro fictício</h2><label>Nome<input name="name" required minLength={2} placeholder="Ex.: Grupo Ponto de Luz" /></label><label>Tipo<select name="kind"><option>Grupo voluntário</option><option>ONG</option><option>Empresa</option><option>Instituição</option></select></label><button className="button primary" disabled={busy}><Plus size={17} /> Salvar parceiro</button></form></div>}
    {view === "actions" && <>
      <div className="ops-columns"><section className="card ops-card ops-list"><h2>Fluxo e agenda</h2>{data.actions.map((item) => <article className="action-row" key={item.id}><div><strong>{item.title}</strong><span className="count-pill">{item.status}</span></div><p>{formatDate(item.scheduled_at)} · {item.department} · {item.participants} participante(s)</p><small>{item.partner_name || "Sem parceiro"} · Origem: {item.source_channel} · Documentos: {item.documents}{item.volunteer_cpf ? ` · CPF ${item.volunteer_cpf}` : ""}</small>{item.notes && <small>{item.notes}</small>}<div className="row-actions">{item.status !== "Realizada" && item.status !== "Cancelada" && <><button className="button outline" disabled={busy} onClick={() => void mutate({ action: "documents", id: item.id, documents: item.documents === "Pendente" ? "Conferido" : "Pendente" }, "Documentos atualizados.")}>{item.documents === "Pendente" ? "Conferir documentos" : "Reabrir conferência"}</button><button className="button primary" disabled={busy} onClick={() => void mutate({ action: "advance", id: item.id }, "Etapa atualizada.")}>Avançar: {next[item.status]}</button><button className="button text-danger" disabled={busy} onClick={() => void mutate({ action: "cancel", id: item.id }, "Ação cancelada.")}>Cancelar</button></>}</div></article>)}</section>
      <form className="card ops-card ops-form" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); void mutate({ action: "create_action", title: values.get("title"), scheduled_at: values.get("scheduled_at"), participants: values.get("participants"), department: values.get("department"), source_channel: values.get("source_channel"), partner_id: values.get("partner_id"), volunteer_cpf: values.get("volunteer_cpf"), notes: values.get("notes") }, "Ação solicitada.", form); }}><h2>Registrar nova ação</h2><label>Nome da atividade<input name="title" required placeholder="Ex.: Oficina de música" /></label><label>Data e horário<input name="scheduled_at" type="datetime-local" required /></label><label>Participantes<input name="participants" type="number" min="1" max="500" defaultValue="2" required /></label><label>Área do hospital<input name="department" required placeholder="Ex.: Humanização" /></label><label>Parceiro<select name="partner_id"><option value="">Sem parceiro</option>{data.partners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>CPF fictício de responsável (opcional)<input name="volunteer_cpf" placeholder="000.000.000-01" /></label><label>Canal de origem<select name="source_channel"><option>WhatsApp</option><option>E-mail</option><option>Formulário</option><option>Telefone</option><option>Outro</option></select></label><label>Observação<textarea name="notes" maxLength={240} placeholder="Informações para a equipe conferir" /></label><button className="button primary" disabled={busy}><Plus size={17} /> Registrar ação</button></form></div>
    </>}
    {view === "donations" && <>
      <div className="ops-columns"><section className="card ops-card ops-list"><h2>Lotes e destinos</h2>{data.donations.map((lot) => <article className="action-row" key={lot.id}><strong>{lot.item}</strong><p>Origem: {lot.donor} · Finalidade: {lot.purpose}</p><small>Recebidos: {lot.quantity_received} {lot.unit} · Destinados: {lot.quantity_distributed} · Saldo: {lot.quantity_received - lot.quantity_distributed}</small>{lot.quantity_received > lot.quantity_distributed && <div className="distribution-row"><input aria-label={`Quantidade para distribuir de ${lot.item}`} type="number" min="1" max={lot.quantity_received - lot.quantity_distributed} placeholder="Qtd." value={distribution[lot.id]?.quantity ?? ""} onChange={(event) => setDistribution({ ...distribution, [lot.id]: { ...distribution[lot.id], quantity: event.target.value, destination: distribution[lot.id]?.destination ?? "" } })} /><input aria-label={`Destino de ${lot.item}`} placeholder="Destino fictício" value={distribution[lot.id]?.destination ?? ""} onChange={(event) => setDistribution({ ...distribution, [lot.id]: { ...distribution[lot.id], quantity: distribution[lot.id]?.quantity ?? "", destination: event.target.value } })} /><button className="button outline" disabled={busy} onClick={() => { void mutate({ action: "distribute", id: lot.id, quantity: distribution[lot.id]?.quantity, destination: distribution[lot.id]?.destination }, "Saída registrada."); }}>Registrar saída</button></div>}</article>)}</section>
      <form className="card ops-card ops-form" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); void mutate({ action: "donation", donor: values.get("donor"), item: values.get("item"), unit: values.get("unit"), quantity: values.get("quantity"), purpose: values.get("purpose") }, "Entrada registrada.", form); }}><h2>Registrar recebimento</h2><label>Quem doou<input name="donor" required placeholder="Ex.: Empresa Exemplo" /></label><label>Item<input name="item" required placeholder="Ex.: Livros infantis" /></label><label>Quantidade<input name="quantity" type="number" min="1" max="100000" required /></label><label>Unidade<input name="unit" required defaultValue="unidades" /></label><label>Finalidade<input name="purpose" required placeholder="Ex.: Oficina" /></label><button className="button primary" disabled={busy}><Plus size={17} /> Registrar entrada</button></form></div>
      <div className="ops-columns"><section className="card ops-card movement-card"><h2>Últimas movimentações</h2>{data.movements.slice(0, 12).map((entry) => <div className="compact-row" key={entry.id}><strong>{entry.kind}: {entry.quantity} {entry.unit} de {entry.item}</strong><small>{entry.kind === "Saída" ? `Destino: ${entry.destination}` : `Origem: ${entry.donor}`} · {formatDate(entry.created_at)}</small></div>)}</section><section className="card ops-card qr-card"><h2>QR simbólico para a turma</h2><Image src="/qr-gesto.svg" width={150} height={150} alt="QR que abre uma mensagem sobre a importância de um gesto" /><p>Escaneie para abrir uma mensagem. Nenhum Pix ou pagamento é realizado.</p><a href="/gesto">Abrir a mensagem</a></section></div>
    </>}
    {view === "report" && <section className="card ops-card report-card"><h2>Resumo de {report?.date ?? "hoje"}</h2><p>Este relatório é gerado dos registros da sessão de demonstração, no fuso de São Paulo. O arquivo CSV abre em Excel ou outra planilha.</p><div className="report-metrics"><span>{report?.totals.signups ?? 0} novo(s) cadastro(s)</span><span>{report?.totals.actions ?? 0} atualização(ões) de ações</span><span>{report?.totals.received ?? 0} item(ns) recebidos</span><span>{report?.totals.distributed ?? 0} item(ns) destinados</span></div><h3>Entradas e saídas</h3>{report?.movements.map((item, index) => <div className="compact-row" key={index}><strong>{item.kind}: {item.quantity} {item.unit} de {item.item}</strong><small>{item.kind === "Saída" ? `Para ${item.destination}` : `De ${item.donor}`}</small></div>)}<h3>Cadastros e atividades</h3>{report?.signups.map((item, index) => <div className="compact-row" key={`v${index}`}><strong>Cadastro: {item.name}</strong><small>{item.niche}</small></div>)}{report?.logs.filter((item) => item.category !== "Doação").map((item, index) => <div className="compact-row" key={`l${index}`}><strong>{item.category}: {item.detail}</strong><small>{formatDate(item.created_at)} · São Paulo</small></div>)}</section>}
  </div>;
}
