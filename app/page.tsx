"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownToLine, ArrowUpFromLine, CalendarDays, Check, ChevronRight, ClipboardCheck, Code2, FileJson, FileSpreadsheet, Gift, HeartHandshake, Menu, MessageCircle, Plus, Search, ShieldCheck, Sparkles, UsersRound, X } from "lucide-react";
import { makeExcel, readExcel } from "../lib/xlsx";
import OperationsPanel, { type OperationsView } from "../components/voluntech/OperationsPanel";
import OperatorPanel from "../components/voluntech/OperatorPanel";
import SqlLab from "../components/voluntech/SqlLab";
import Welcome from "../components/voluntech/Welcome";
import { ButterflyMark } from "../components/voluntech/ButterflyMark";

type Volunteer = {
  id: number; cpf: string; name: string; email: string; niche: string; company: string;
  address: string; city: string; phone: string; availability: string; status: string; stage: string;
  created_at: string; updated_at: string;
};
type FormData = Omit<Volunteer, "id" | "created_at" | "updated_at">;
type Tab = "overview" | "actions" | "partners" | "donations" | "report" | "volunteers" | "backup" | "technical" | "operator" | "about";
type Staff = { display_name: string; expires_at: string };
type Match = Pick<Volunteer, "id" | "cpf" | "name" | "niche" | "city" | "status" | "stage">;
type ApiResponse = { error?: string; volunteers?: Volunteer[]; volunteer?: Volunteer | null; reply?: string; matches?: Match[]; total?: number; nextOffset?: number | null; sql?: string; countSql?: string; params?: (string | number)[]; columns?: string[]; rows?: Record<string, string | number>[]; imported?: number; updated?: number; skipped?: number };
type ImportRecord = FormData & { provided_fields: (keyof FormData)[] };
type ImportMode = "add" | "merge";

const emptyForm: FormData = { cpf: "", name: "", email: "", niche: "", company: "", address: "", city: "", phone: "", availability: "", status: "Em análise", stage: "Inscrição" };
const fields: { key: keyof FormData; label: string; placeholder?: string; required?: boolean; hint?: string }[] = [
  { key: "name", label: "Nome completo", required: true, placeholder: "Ex.: Marina Costa" },
  { key: "cpf", label: "CPF de teste", required: true, placeholder: "000.000.000-05", hint: "Use um número fictício com 11 dígitos e verificador inválido." },
  { key: "niche", label: "Área de atuação", required: true, placeholder: "Ex.: Música, palhaçaria, beleza" },
  { key: "email", label: "E-mail de teste", placeholder: "nome@exemplo.test" },
  { key: "phone", label: "Celular de teste", placeholder: "(00) 11987-6543", hint: "Use DDD 00 na demonstração." },
  { key: "company", label: "Grupo ou empresa", placeholder: "Opcional" },
  { key: "city", label: "Cidade", placeholder: "Opcional" },
  { key: "address", label: "Endereço", placeholder: "Opcional" },
  { key: "availability", label: "Disponibilidade", placeholder: "Ex.: quinta à tarde" },
];
const onlyDigits = (s: string) => s.replace(/\D/g, "");
const displayCpf = (s: string) => {
  const d = onlyDigits(s);
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : s;
};
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

function csvRows(raw: string): string[][] {
  const firstLine = raw.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0];
  const delimiter = (firstLine.match(/;/g) ?? []).length >= (firstLine.match(/,/g) ?? []).length ? ";" : ",";
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  const text = raw.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || cell === "") quoted = !quoted;
      else cell += char;
    } else if (char === delimiter && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); if (row.some((item) => item.trim())) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("CSV com aspas não fechadas.");
  row.push(cell); if (row.some((item) => item.trim())) rows.push(row);
  return rows;
}
const aliases: Record<string, keyof FormData> = {
  nome: "name", nomecompleto: "name", name: "name", cpf: "cpf",
  email: "email", emailcontato: "email", correioeletronico: "email",
  nicho: "niche", areadeatuacao: "niche", area: "niche", atividade: "niche", niche: "niche",
  empresa: "company", grupo: "company", instituicao: "company", company: "company",
  endereco: "address", address: "address", cidade: "city", city: "city",
  celular: "phone", telefone: "phone", numero: "phone", phone: "phone",
  disponibilidade: "availability", availability: "availability",
  situacao: "status", status: "status", etapa: "stage", stage: "stage",
};
function normalizeHeader(s: string) { return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ""); }
function parseImport(raw: string, filename: string, spreadsheetRows?: Record<string, string>[]): ImportRecord[] {
  let source: unknown[];
  if (spreadsheetRows) source = spreadsheetRows;
  else if (filename.toLowerCase().endsWith(".json")) {
    const parsed: unknown = JSON.parse(raw);
    source = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === "object" && "records" in parsed && Array.isArray(parsed.records)) ? parsed.records : [];
  } else {
    const rows = csvRows(raw);
    if (rows.length < 2) throw new Error("O CSV precisa de cabeçalho e pelo menos uma pessoa.");
    const keys = rows.shift()!.map((header) => aliases[normalizeHeader(header)]);
    if (!keys.includes("name") || !keys.includes("cpf") || !keys.includes("niche")) throw new Error("O CSV precisa das colunas nome, CPF e área de atuação.");
    source = rows.map((row) => Object.fromEntries(keys.map((key, index) => [key, row[index] ?? ""]).filter(([key]) => !!key)));
  }
  if (!source.length || source.length > 2000) throw new Error("O arquivo deve ter entre 1 e 2.000 pessoas.");
  return source.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Linha ${index + 1} inválida.`);
    const record = entry as Record<string, unknown>;
    const mapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) mapped[aliases[normalizeHeader(key)] ?? key] = value;
    const provided_fields = Object.keys(mapped).filter((key): key is keyof FormData => key in emptyForm);
    return { ...Object.fromEntries(Object.keys(emptyForm).map((key) => [key, String(mapped[key] ?? (key === "status" ? "Em análise" : key === "stage" ? "Inscrição" : ""))])), provided_fields } as ImportRecord;
  });
}
async function api(path: string, init?: RequestInit): Promise<ApiResponse> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...init });
  const data = await response.json() as ApiResponse;
  if (!response.ok) throw new Error(data.error ?? "Ocorreu um erro. Tente novamente.");
  return data;
}
function download(blob: Blob, extension: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `voluntech-backup-${new Date().toISOString().slice(0, 10)}.${extension}`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function safeRecords(records: Volunteer[]): FormData[] {
  return records.map(({ cpf, name, email, niche, company, address, city, phone, availability, status, stage }) =>
    ({ cpf, name, email, niche, company, address, city, phone, availability, status, stage }));
}
function downloadJson(records: Volunteer[]) {
  const body = JSON.stringify({ format: "lacos-backup-v2", exported_at: new Date().toISOString(), records: safeRecords(records) }, null, 2);
  download(new Blob([body], { type: "application/json;charset=utf-8" }), "json");
}
function downloadExcel(records: Volunteer[]) {
  const bytes = makeExcel(safeRecords(records));
  download(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "xlsx");
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("overview");
  const [staff, setStaff] = useState<Staff | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [rows, setRows] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState("");
  const [editing, setEditing] = useState<Volunteer | "new" | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [fileRecords, setFileRecords] = useState<ImportRecord[]>([]);
  const [fileName, setFileName] = useState("");
  const [importMode, setImportMode] = useState<ImportMode>("add");
  const [assistantQuery, setAssistantQuery] = useState("");
  const [assistantReply, setAssistantReply] = useState("Posso buscar CPF, combinar áreas e mostrar cadastros em análise ou incompletos.");
  const [assistantMatches, setAssistantMatches] = useState<Match[]>([]);
  const [assistantTotal, setAssistantTotal] = useState(0);
  const [assistantNext, setAssistantNext] = useState<number | null>(null);
  const [assistantSql, setAssistantSql] = useState("");
  const [assistantListOpen, setAssistantListOpen] = useState(false);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [visibleCount, setVisibleCount] = useState(40);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    let mounted = true;
    fetch("/api/auth", { credentials: "same-origin", cache: "no-store" }).then((response) => response.json() as Promise<{ staff?: Staff | null }>).then((result) => { if (mounted) setStaff(result.staff ?? null); }).catch(() => {}).finally(() => { if (mounted) setAuthLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function reload() {
    try { const result = await api("/api/volunteers"); setRows(result.volunteers ?? []); setError(""); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    if (!staff) return;
    let mounted = true;
    api("/api/volunteers").then((result) => { if (mounted) { setRows(result.volunteers ?? []); setError(""); } })
      .catch((err) => { if (mounted) setError((err as Error).message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [staff]);
  // Selo "pessoas aguardando" no menu, mesmo quando a atendente está em outra tela.
  useEffect(() => {
    if (!staff) return;
    let live = true;
    const check = () => fetch("/api/chat/operator", { credentials: "same-origin", cache: "no-store" }).then((response) => response.json() as Promise<{ queue?: unknown[] }>).then((data) => { if (live) setWaiting(data.queue?.length ?? 0); }).catch(() => {});
    void check(); const interval = setInterval(check, 6000);
    return () => { live = false; clearInterval(interval); };
  }, [staff]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") { setEditing(null); setAssistantListOpen(false); } }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    if (!term) return rows;
    // Ignore punctuation in CPF searches: 000.000.000.50 and 000.000.000-50 are identical.
    if (/^[\d.\-/\s]+$/.test(term) && onlyDigits(term)) {
      const cpfDigits = onlyDigits(term);
      return rows.filter((row) => row.cpf.includes(cpfDigits));
    }
    return rows.filter((row) => [row.name, row.cpf, displayCpf(row.cpf), row.niche, row.city, row.company].some((field) => field.toLocaleLowerCase("pt-BR").includes(term)));
  }, [rows, query]);
  const fullCpf = /^[\d.\-/\s]+$/.test(query.trim()) && onlyDigits(query).length === 11 ? onlyDigits(query) : "";
  const exactCpfMatch = fullCpf ? rows.find((row) => row.cpf === fullCpf) : undefined;
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => { const key = row.name.trim().toLocaleLowerCase("pt-BR"); counts.set(key, (counts.get(key) ?? 0) + 1); });
    return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
  }, [rows]);
  const pending = rows.filter((row) => row.status === "Em análise").length;
  const incomplete = rows.filter((row) => !row.email || !row.phone || !row.city).length;
  const active = rows.filter((row) => row.status === "Ativo").length;

  async function logout() {
    await fetch("/api/auth", { method: "DELETE", credentials: "same-origin" });
    setStaff(null); setRows([]); setTab("overview");
  }

  function openForm(person?: Volunteer, cpf = "") {
    setError("");
    setForm(person ? { cpf: person.cpf, name: person.name, email: person.email, niche: person.niche, company: person.company, address: person.address, city: person.city, phone: person.phone, availability: person.availability, status: person.status, stage: person.stage } : { ...emptyForm, cpf });
    setEditing(person ?? "new");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const existing = editing && editing !== "new" ? editing : null;
      await api("/api/volunteers", { method: existing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, ...(existing ? { id: existing.id } : {}) }) });
      setEditing(null); setNotFound(""); setToast(existing ? "Cadastro atualizado." : "Voluntário cadastrado.");
      await reload();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }
  async function searchCpf() {
    const cpf = onlyDigits(query);
    if (cpf.length !== 11) { setNotFound("Digite um CPF de 11 dígitos para a busca exata."); return; }
    try {
      const result = await api(`/api/volunteers?cpf=${cpf}`);
      if (result.volunteer) { setNotFound(""); openForm(result.volunteer as Volunteer); }
      else setNotFound(cpf);
    } catch (err) { setError((err as Error).message); }
  }
  async function ask(question = assistantQuery, offset = 0) {
    if (!question.trim()) return;
    setAssistantQuery(question); setAssistantBusy(true);
    try {
      const result = await api(`/api/assistant?q=${encodeURIComponent(question)}&offset=${offset}`);
      setAssistantReply(result.reply ?? "Sem resposta."); setAssistantMatches(offset ? [...assistantMatches, ...(result.matches ?? [])] : result.matches ?? []);
      setAssistantTotal(result.total ?? 0); setAssistantNext(result.nextOffset ?? null); setAssistantSql(result.sql ?? ""); setError("");
      if ((result.total ?? 0) > 0) setAssistantListOpen(true);
    } catch (err) { setError((err as Error).message); }
    finally { setAssistantBusy(false); }
  }
  async function selectFile(file?: File) {
    setFileRecords([]); setFileName(""); setImportMode("add"); setError("");
    if (!file) return;
    try {
      if (!/\.(csv|json|xlsx)$/i.test(file.name)) throw new Error("Escolha um arquivo Excel (.xlsx), CSV ou JSON.");
      if (file.size > 5_000_000) throw new Error("O arquivo deve ter no máximo 5 MB.");
      const records = file.name.toLowerCase().endsWith(".xlsx")
        ? parseImport("", file.name, readExcel(new Uint8Array(await file.arrayBuffer())))
        : parseImport(await file.text(), file.name);
      setFileRecords(records); setFileName(file.name);
    } catch (err) { setError((err as Error).message); }
  }
  async function importRecords() {
    setSaving(true); setError("");
    try {
      if (importMode === "merge") downloadJson(rows);
      const result = await api("/api/volunteers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "import", mode: importMode, records: fileRecords }) });
      setFileRecords([]); setFileName(""); setToast(`${result.imported ?? 0} novo(s), ${result.updated ?? 0} atualizado(s), ${result.skipped ?? 0} sem alteração.`); await reload();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }
  const existingCpfs = new Set(rows.map((row) => row.cpf));
  const existingInFile = fileRecords.filter((row) => existingCpfs.has(onlyDigits(row.cpf))).length;
  if (authLoading) return <div className="loading-page">Abrindo VolunTech…</div>;
  if (!staff) return <Welcome onLogin={(profile) => { setStaff(profile); setLoading(true); }} />;

  const hour = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date()));
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const navigation: { id: Tab; label: string; icon: typeof UsersRound }[] = [
    { id: "overview", label: "Visão do setor", icon: Activity },
    { id: "actions", label: "Ações e agenda", icon: CalendarDays },
    { id: "partners", label: "Parceiros", icon: HeartHandshake },
    { id: "donations", label: "Doações", icon: Gift },
    { id: "volunteers", label: "Voluntários", icon: UsersRound },
    { id: "report", label: "Relatório do dia", icon: ClipboardCheck },
    { id: "operator", label: "Fila de dúvidas", icon: MessageCircle },
    { id: "backup", label: "Importar e backup", icon: ArrowUpFromLine },
    { id: "about", label: "Sobre o projeto", icon: ClipboardCheck },
  ];
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><ButterflyMark size={32} /></span><span><strong>VolunTech</strong><small>GESTÃO DO VOLUNTARIADO</small></span></div>
        <p className="nav-heading">ESPAÇO DE TRABALHO</p>
        <nav aria-label="Navegação principal">
          {navigation.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={`nav-item ${tab === id ? "active" : ""}`} onClick={() => { setTab(id); setMenuOpen(false); setError(""); }}><Icon size={20} />{label}{id === "operator" && waiting > 0 && <span className="nav-badge" aria-label={`${waiting} aguardando`}>{waiting}</span>}</button>)}
        </nav>
        <div className="sidebar-tools"><button type="button" className={tab === "technical" ? "active" : ""} onClick={() => { setTab("technical"); setMenuOpen(false); setError(""); }}><Code2 size={16} /> Laboratório SQL</button></div>
        <div className="sidebar-bottom"><span className="demo-dot" /><span>Projeto acadêmico · FAM<small>Somente dados fictícios</small></span><button className="logout-button" onClick={() => void logout()}>Sair</button></div>
      </aside>
      <div className="content">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Abrir menu" onClick={() => setMenuOpen(!menuOpen)}><Menu size={22} /></button>
          <div className="breadcrumb"><span>Área de voluntariado</span><ChevronRight size={16} /><strong>{tab === "technical" ? "Laboratório SQL" : navigation.find((item) => item.id === tab)?.label}</strong></div>
          <span className="demo-badge"><ShieldCheck size={16} /> {greeting}, {staff.display_name} · demonstração</span>
        </header>
        <main className="main">
          {(["overview", "actions", "partners", "donations", "report"] as Tab[]).includes(tab) && <OperationsPanel view={tab as OperationsView} />}
          {tab === "operator" && <OperatorPanel />}
          {tab === "volunteers" && <>
            <div className="page-heading"><div><p className="eyebrow">PAINEL DE CADASTROS</p><h1>Voluntários</h1><p className="subline">Encontre pessoas, confira informações e mantenha os contatos organizados.</p></div><button className="button primary" onClick={() => openForm()}><Plus size={20} /> Novo voluntário</button></div>
            <div className="notice"><ShieldCheck size={21} /><span>Este espaço é fictício e individual. Use somente nomes e contatos inventados para testar.</span></div>
            <div className="stats">
              <div className="stat"><span className="stat-icon teal"><UsersRound size={21} /></span><div><span>Total de cadastros</span><strong>{loading ? "—" : rows.length}</strong></div></div>
              <div className="stat"><span className="stat-icon green"><Check size={21} /></span><div><span>Voluntários ativos</span><strong>{loading ? "—" : active}</strong></div></div>
              <div className="stat"><span className="stat-icon amber"><Activity size={21} /></span><div><span>Em análise</span><strong>{loading ? "—" : pending}</strong></div></div>
              <div className="stat"><span className="stat-icon rose"><ClipboardCheck size={21} /></span><div><span>Para conferir</span><strong>{loading ? "—" : incomplete}</strong></div></div>
            </div>
            <div className="workspace-grid">
              <section className="card roster">
                <div className="section-heading"><div><h2>Lista de pessoas</h2><p>Busque por nome, CPF, área ou cidade.</p></div><span className="count-pill">{filtered.length} registros</span></div>
                <div className="search-row"><div className="search-field"><Search size={20} /><input aria-label="Buscar voluntário" placeholder="Nome ou CPF (com ou sem pontuação)" value={query} onChange={(e) => { setQuery(e.target.value); setNotFound(""); }} onKeyDown={(e) => { if (e.key === "Enter" && onlyDigits(query).length === 11) void searchCpf(); }} /></div><button className="button outline" onClick={() => void searchCpf()}>Abrir CPF</button></div>
                {notFound && notFound.length !== 11 && <div className="search-feedback" role="status">{notFound}</div>}
                {!loading && exactCpfMatch && <div className="search-feedback found" role="status"><span>CPF localizado: <strong>{exactCpfMatch.name}</strong> · {displayCpf(exactCpfMatch.cpf)}</span><button className="inline-link" onClick={() => openForm(exactCpfMatch)}>Abrir ficha</button></div>}
                {!loading && fullCpf && !exactCpfMatch && <div className="search-feedback" role="status"><span>Nenhum cadastro para <strong>{displayCpf(fullCpf)}</strong>.</span><button className="inline-link" onClick={() => openForm(undefined, fullCpf)}>Cadastrar pessoa</button></div>}
                {loading ? <div className="empty-result">Carregando cadastros…</div> : filtered.length ? <div className="roster-list">
                  {filtered.slice(0, visibleCount).map((person) => <button className="person-row" key={person.id} onClick={() => openForm(person)}>
                    <span className="avatar">{initials(person.name)}</span>
                    <span className="person-main"><span className="name-line"><strong>{person.name}</strong>{duplicateNames.has(person.name.trim().toLocaleLowerCase("pt-BR")) && <span className="duplicate-label">Nome repetido</span>}</span><small className="person-cpf">CPF {displayCpf(person.cpf)}</small><small>{person.niche} <span>·</span> {person.city || "Cidade não informada"} <span>·</span> {person.stage}</small></span>
                    <span className="person-meta"><span className={`status ${person.status === "Ativo" ? "active" : person.status === "Inativo" ? "inactive" : "review"}`}>{person.status}</span></span>
                    <ChevronRight className="row-chevron" size={18} />
                  </button>)}
                  {filtered.length > visibleCount && <button className="show-more" onClick={() => setVisibleCount(visibleCount + 40)}>Mostrar mais 40 pessoas ({filtered.length - visibleCount} restantes)</button>}
                </div> : !fullCpf && <div className="empty-result">Nenhuma pessoa encontrada. Confira a busca ou crie um cadastro.</div>}
              </section>
              <aside className="card assistant">
                <div className="assistant-title"><span className="assistant-icon"><Sparkles size={22} /></span><div><h2>Assistente de conferência</h2><p>Consulta os cadastros da sua demonstração</p></div></div>
                <div className="assistant-reply" aria-live="polite"><span className="reply-dot" />{assistantReply}</div>
                {assistantTotal > 0 && <button className="button outline assistant-open" onClick={() => setAssistantListOpen(true)}>Abrir lista de {assistantTotal} pessoa(s) <ChevronRight size={17} /></button>}
                <div className="prompt-list"><span>Experimente perguntar</span><button onClick={() => void ask("cabelo e música")}>Cabelo e música</button><button onClick={() => void ask("em análise e incompletos")}>Em análise e incompletos</button><button onClick={() => void ask("quantos voluntários")}>Quantos voluntários?</button></div>
                <form className="assistant-form" onSubmit={(e) => { e.preventDefault(); void ask(); }}><input aria-label="Pergunta para o assistente" placeholder="Digite um CPF ou uma pergunta" value={assistantQuery} onChange={(e) => setAssistantQuery(e.target.value)} /><button aria-label="Perguntar ao assistente" disabled={assistantBusy || !assistantQuery.trim()}><Search size={18} /></button></form>
                <p className="assistant-foot">Consultas SQL de leitura, com critérios verificáveis. Veja a aba Laboratório SQL.</p>
              </aside>
            </div>
          </>}
          {tab === "backup" && <div className="secondary-page"><p className="eyebrow">DADOS E PORTABILIDADE</p><h1>Importar e fazer backup</h1><p className="subline">Traga uma planilha de teste ou guarde uma cópia dos cadastros desta demonstração.</p><div className="notice"><ShieldCheck size={21} /><span>Não envie uma base real do hospital. Esta área aceita somente CPFs de teste, e-mails .test e telefones com DDD 00.</span></div>
            <div className="two-cards">
              <section className="card action-card"><span className="large-icon"><ArrowUpFromLine size={26} /></span><h2>Importar cadastros</h2><p>Excel (.xlsx), CSV ou JSON, até 2.000 pessoas e 5 MB por arquivo. Confira a prévia antes de salvar; o mesmo CPF não cria uma segunda ficha.</p><label className="button primary file-label">Escolher arquivo<input type="file" accept=".xlsx,.csv,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => { void selectFile(e.target.files?.[0]); e.target.value = ""; }} /></label><a className="sample-link" href="/examples/voluntarios-exemplo.csv" download="voluntarios-exemplo.csv"><ArrowDownToLine size={15} /> Baixar CSV fictício para testar</a><small>Nome, CPF e área de atuação são obrigatórios.</small></section>
              <section className="card action-card"><span className="large-icon blue"><FileSpreadsheet size={26} /></span><h2>Baixar backup</h2><p>Use Excel para abrir e conferir as pessoas em colunas. O JSON serve como cópia estruturada para importar novamente. Ambos preservam zeros à esquerda do CPF.</p><div className="backup-buttons"><button className="button primary" onClick={() => downloadExcel(rows)} disabled={loading}><ArrowDownToLine size={18} /> Baixar Excel</button><button className="button outline" onClick={() => downloadJson(rows)} disabled={loading}><FileJson size={18} /> Baixar JSON</button></div><small>{rows.length} pessoa(s) disponíveis para exportar.</small></section>
            </div>
            {fileRecords.length > 0 && <section className="card preview-card">
              <div className="section-heading"><div><h2>Conferir importação</h2><p>{fileName} · {fileRecords.length} pessoa(s) · {fileRecords.length - existingInFile} nova(s) · {existingInFile} CPF(s) já cadastrado(s)</p></div><button className="icon-button" aria-label="Cancelar importação" onClick={() => { setFileRecords([]); setFileName(""); }}><X size={19} /></button></div>
              <div className="preview-scroll"><table><thead><tr><th>Nome</th><th>CPF</th><th>Área</th><th>Cidade</th><th>No banco</th></tr></thead><tbody>{fileRecords.slice(0, 8).map((row, i) => <tr key={i}><td>{row.name}</td><td>{displayCpf(row.cpf)}</td><td>{row.niche}</td><td>{row.city || "—"}</td><td>{existingCpfs.has(onlyDigits(row.cpf)) ? "Já existe" : "Novo"}</td></tr>)}</tbody></table></div>
              {fileRecords.length > 8 && <p className="muted">Exibindo 8 de {fileRecords.length} registros.</p>}
              <fieldset className="import-options"><legend>Como tratar CPFs já cadastrados?</legend><label><input type="radio" name="import-mode" checked={importMode === "add"} onChange={() => setImportMode("add")} /><span><strong>Adicionar somente novos</strong><small>Preserva todas as fichas existentes.</small></span></label><label><input type="radio" name="import-mode" checked={importMode === "merge"} onChange={() => setImportMode("merge")} /><span><strong>Atualizar pelo CPF</strong><small>Inclui novos e atualiza apenas campos informados e não vazios. Baixa um backup JSON antes.</small></span></label></fieldset>
              <button className="button primary" disabled={saving || loading} onClick={() => void importRecords()}>{saving ? "Importando…" : importMode === "merge" ? "Confirmar e atualizar" : "Confirmar importação"}</button>
            </section>}
            <section className="format-note"><h2>Colunas reconhecidas</h2><p>Nome, CPF, e-mail, nicho ou área de atuação, empresa ou grupo, endereço, cidade, celular ou telefone, disponibilidade, situação e etapa. Colunas extras são ignoradas. No CSV, use ponto e vírgula ou vírgula como separador.</p></section>
          </div>}
          {tab === "technical" && <SqlLab />}
          {tab === "about" && <div className="secondary-page"><p className="eyebrow">PROJETO ACADÊMICO · FAM</p><h1>Sobre o VolunTech</h1><p className="subline">Uma proposta para reunir as informações do voluntariado hospitalar.</p><div className="about-grid"><section className="card text-card"><h2>A dor do setor</h2><p>O contexto compartilhado pelo colega, a partir do relato da supervisão do setor, descreve informações espalhadas entre WhatsApp, e-mails, formulários, planilhas e sistemas internos. Para saber o andamento de uma ação, a equipe procura datas, participantes, responsáveis, documentos e aprovações em vários lugares. A entrevista direta e os critérios institucionais ainda precisam ser confirmados pelo grupo.</p><h2>O que esta versão reúne</h2><p>Voluntários, parceiros, ações com agenda e etapas, marcação de documentos conferidos, recebimento e destino de doações, histórico diário, relatório para planilha e chat com fila. Canais como WhatsApp são registrados como origem; não há integração automática com eles.</p></section><section className="card text-card"><h2>Doações rastreáveis</h2><p>Cada lote fictício registra quem doou, item, quantidade, finalidade e recebimento. A saída exige quantidade disponível e destino; o relatório do dia mostra entradas e saídas. Não há doação financeira: o QR simbólico abre somente uma mensagem de agradecimento.</p><h2>Limites da demonstração</h2><p>A senha é pública para a turma e não é uma conta hospitalar. O controle de documentos é um marcador, sem arquivos anexados; alertas dependem da tela de atendimento aberta. Para uso real seriam necessários perfis, autenticação institucional, auditoria, retenção, integrações, política de dados e validação do fluxo com a equipe.</p></section></div></div>}
          {error && <div className="error-banner" role="alert">{error}<button aria-label="Fechar aviso" onClick={() => setError("")}><X size={16} /></button></div>}
          {toast && <div className="toast" role="status"><Check size={18} />{toast}</div>}
        </main>
      </div>
      {assistantListOpen && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setAssistantListOpen(false); }}><div className="modal result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title"><div className="modal-head"><div><p className="eyebrow">ASSISTENTE DE CONFERÊNCIA</p><h2 id="result-title">{assistantTotal} pessoa(s) encontradas</h2></div><button className="icon-button" onClick={() => setAssistantListOpen(false)} aria-label="Fechar resultados"><X size={22} /></button></div><p className="result-summary">{assistantReply}</p><div className="result-list">{assistantMatches.map((match) => <button key={match.id} onClick={() => { setAssistantListOpen(false); const person = rows.find((item) => item.id === match.id); if (person) openForm(person); }}><span className="avatar">{initials(match.name)}</span><span className="person-main"><strong>{match.name}</strong><small className="person-cpf">CPF {displayCpf(match.cpf)}</small><small>{match.niche} · {match.city || "Cidade pendente"} · {match.stage}</small></span><span className={`status ${match.status === "Ativo" ? "active" : match.status === "Inativo" ? "inactive" : "review"}`}>{match.status}</span></button>)}</div>{assistantNext !== null && <button className="button outline load-matches" disabled={assistantBusy} onClick={() => void ask(assistantQuery, assistantNext)}>{assistantBusy ? "Carregando…" : "Mostrar mais resultados"}</button>}<details className="executed-sql"><summary>Ver consulta SQL usada pelo assistente</summary><pre>{assistantSql}</pre><p>Os valores são enviados separadamente como parâmetros e o banco só vê a sua sessão.</p></details></div></div>}
      {editing && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title"><div className="modal-head"><div><p className="eyebrow">CADASTRO DE VOLUNTÁRIO</p><h2 id="form-title">{editing === "new" ? "Nova pessoa" : "Dados da pessoa"}</h2></div><button className="icon-button" onClick={() => setEditing(null)} aria-label="Fechar cadastro"><X size={22} /></button></div><form onSubmit={(e) => void save(e)}><div className="form-grid">{fields.map(({ key, label, placeholder, required, hint }) => <label key={key} className={key === "address" ? "wide" : ""}><span>{label}{required && <em> *</em>}</span><input autoFocus={key === "name"} value={form[key]} placeholder={placeholder} required={required} maxLength={key === "address" ? 160 : 120} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />{hint && <small>{hint}</small>}</label>)}<label><span>Situação</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Em análise</option><option>Ativo</option><option>Inativo</option></select></label><label><span>Etapa do processo</span><select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}><option>Inscrição</option><option>Entrevista</option><option>Treinamento</option><option>Termo pendente</option><option>Liberado</option></select></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button outline" onClick={() => setEditing(null)}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? "Salvando…" : editing === "new" ? "Cadastrar pessoa" : "Salvar alterações"}</button></div></form></div></div>}
    </div>
  );
}
