"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CircleCheck, CircleX, Code2, Copy, Play, ShieldCheck } from "lucide-react";
import { sqlSchema } from "../../lib/sql-lab";
import { levels, steps, type Step } from "../../lib/sql-tutorial";

type Result = { columns?: string[]; rows?: Record<string, string | number | null>[]; sql?: string; params?: (string | number)[]; error?: string; status: number };
type Check = { pass: boolean; info: string };

async function runQuery(query: string): Promise<Result> {
  try {
    const response = await fetch("/api/sql", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
    const data = await response.json() as Omit<Result, "status">;
    return { ...data, status: response.status };
  } catch { return { error: "Não foi possível falar com o servidor.", status: 0 }; }
}

function judge(step: Step, result: Result): Check {
  if (step.blocked) return result.status === 400 ? { pass: true, info: "bloqueada, como esperado" } : { pass: false, info: `deveria ser bloqueada (HTTP ${result.status})` };
  if (result.status !== 200) return { pass: false, info: result.error ?? `HTTP ${result.status}` };
  const rows = result.rows?.length ?? 0;
  return rows > 0 ? { pass: true, info: `${rows} linha(s)` } : { pass: false, info: "nenhuma linha retornada" };
}

export default function SqlLab() {
  const [current, setCurrent] = useState(0);
  const [query, setQuery] = useState(steps[0].query);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<Record<number, Check>>({});
  const [auditing, setAuditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const step = steps[current];
  const visibleChecks = Object.values(checks);

  async function run(text = query, index: number | null = null) {
    setBusy(true); setResult(null);
    const outcome = await runQuery(text);
    setResult(outcome);
    if (index !== null) setChecks((previous) => ({ ...previous, [index]: judge(steps[index], outcome) }));
    setBusy(false);
  }
  function go(index: number, execute = true) {
    const next = Math.min(Math.max(index, 0), steps.length - 1);
    setCurrent(next); setQuery(steps[next].query); setResult(null);
    if (execute) void run(steps[next].query, next);
  }
  async function audit() {
    setAuditing(true); setChecks({});
    for (let index = 0; index < steps.length; index++) {
      const outcome = await runQuery(steps[index].query);
      setChecks((previous) => ({ ...previous, [index]: judge(steps[index], outcome) }));
    }
    setAuditing(false);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(query); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* sem permissão de área de transferência */ }
  }
  const passed = visibleChecks.filter((item) => item.pass).length;
  const allDone = visibleChecks.length === steps.length;
  const blocked = result && result.status === 400;

  return <div className="secondary-page technical-page">
    <p className="eyebrow">BASTIDORES · PROJETO ACADÊMICO FAM</p>
    <h1>Laboratório SQL</h1>
    <p className="subline">Mostre ao professor como o banco responde: buscas, análises, cruzamento de tabelas e tentativas de ataque, tudo com roteiro e execução de verdade nos dados da sua sessão.</p>
    <div className="notice"><ShieldCheck size={21} /><span>Console somente de leitura. O servidor lê a consulta, confere tabelas e colunas numa lista de permissões, monta um SQL novo com parâmetros e sempre acrescenta o filtro da sua sessão.</span></div>

    <section className="card sql-card lab-tour">
      <div className="section-heading"><div><h2>Roteiro guiado · passo {current + 1} de {steps.length}</h2><p>Use as setas para apresentar na ordem, ou clique em um tema.</p></div><Code2 size={22} className="code-icon" /></div>
      <div className="lab-levels">{levels.map((level) => <button key={level} className={step.level === level ? "active" : ""} onClick={() => go(steps.findIndex((item) => item.level === level))}>{level}</button>)}</div>
      <div className="lab-step"><div><span className="lab-tag">{step.level}</span><h3>{step.title}</h3></div><p className="lab-say"><strong>Para falar:</strong> {step.say}</p><p className="lab-shows">Conceito: {step.shows}</p></div>
      <label className="sql-label" htmlFor="sql-editor">SQL editável</label>
      <textarea id="sql-editor" spellCheck={false} value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="sql-actions">
        <div className="lab-nav"><button className="button outline" onClick={() => go(current - 1)} disabled={current === 0 || busy} aria-label="Passo anterior"><ChevronLeft size={18} /></button><button className="button outline" onClick={() => go(current + 1)} disabled={current === steps.length - 1 || busy} aria-label="Próximo passo"><ChevronRight size={18} /></button><button className="button outline" onClick={() => void copy()}><Copy size={16} />{copied ? "Copiado" : "Copiar SQL"}</button></div>
        <button className="button primary" disabled={busy} onClick={() => void run(query, query === step.query ? current : null)}><Play size={16} />{busy ? "Consultando…" : "Executar SQL"}</button>
      </div>
    </section>

    {result && <section className="card sql-output">
      <div className="section-heading"><div><h2>{blocked ? (step.blocked && query === step.query ? "Bloqueado, como esperado ✔" : "Consulta recusada") : result.error ? "Erro na consulta" : "Resultado da consulta"}</h2><p>{result.error ? "Nada foi executado no banco." : `${result.rows?.length ?? 0} linha(s) retornada(s)`}</p></div><span className="count-pill">D1 · SQLite</span></div>
      {result.error ? <p className={`lab-error ${blocked ? "guarded" : ""}`} role="alert"><strong>Motivo:</strong> {result.error}</p>
        : <div className="preview-scroll"><table><thead><tr>{result.columns?.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{result.rows?.map((row, index) => <tr key={index}>{result.columns?.map((column) => <td key={column}>{row[column] === "" ? "—" : row[column] === null ? "—" : String(row[column])}</td>)}</tr>)}</tbody></table>{!result.rows?.length && <p className="muted">Nenhuma linha correspondeu aos filtros.</p>}</div>}
      {result.sql && <details className="executed-sql" open><summary>Ver o SQL que o servidor montou e executou</summary><pre>{result.sql}</pre><p>Parâmetros, na ordem dos <code>?</code>: {JSON.stringify(result.params)}. O primeiro identifica a sua sessão e não revela o código interno. Os textos que você digitou viajam como parâmetros, nunca dentro do SQL.</p></details>}
    </section>}

    <section className="card lab-audit">
      <div className="section-heading"><div><h2>Verificação automática</h2><p>Roda os {steps.length} passos e confere: consultas devem retornar dados e os ataques devem ser recusados.</p></div><button className="button primary" disabled={auditing || busy} onClick={() => void audit()}>{auditing ? `Verificando ${visibleChecks.length}/${steps.length}…` : "Verificar tudo"}</button></div>
      {visibleChecks.length > 0 && <>
        {allDone && <p className={`lab-summary ${passed === steps.length ? "good" : "bad"}`}>{passed === steps.length ? `✔ ${passed} de ${steps.length} passos funcionaram: ${steps.filter((item) => !item.blocked).length} consultas e ${steps.filter((item) => item.blocked).length} bloqueios de segurança.` : `${steps.length - passed} passo(s) com problema. Veja a lista abaixo.`}</p>}
        <ul className="lab-checks">{steps.map((item, index) => checks[index] && <li key={item.title} className={checks[index].pass ? "pass" : "fail"}>{checks[index].pass ? <CircleCheck size={17} /> : <CircleX size={17} />}<span><strong>{item.title}</strong><small>{item.level} · {checks[index].info}</small></span><button className="lab-link" onClick={() => go(index)}>abrir</button></li>)}</ul>
      </>}
    </section>

    <div className="about-grid technical-notes">
      <section className="card text-card"><h2>Dicionário de dados</h2><p>Tabelas e colunas liberadas no laboratório (<em>texto</em> ou <em>número</em>). Fichas, parceiros, ações e doações são todos fictícios.</p><div className="lab-dict">{Object.entries(sqlSchema).map(([table, columns]) => <div key={table}><code>{table}</code><small>{Object.entries(columns).map(([name, type]) => `${name}${type === "int" ? " (nº)" : ""}`).join(" · ")}</small></div>)}</div><p><strong>Cruzamentos liberados:</strong> <code>actions.partner_id = partners.id</code> e <code>donation_movements.donation_id = donations.id</code>.</p></section>
      <section className="card text-card"><h2>Como o servidor protege</h2><ol className="lab-protect"><li><strong>Lê antes de executar:</strong> a consulta vira uma lista de pedaços (SELECT, tabela, coluna) e cada um é conferido.</li><li><strong>Lista de permissões:</strong> só tabelas e colunas do dicionário de dados.</li><li><strong>Parâmetros:</strong> valores digitados vão como <code>?</code>, nunca dentro do SQL.</li><li><strong>Sessão:</strong> toda tabela consultada recebe <code>owner = ?</code>, inclusive a outra ponta de um JOIN.</li><li><strong>Limites:</strong> uma instrução, até 200 linhas, sem comentários.</li></ol><h2>Escrevendo suas próprias consultas</h2><p>Em consultas com JOIN, dê um apelido a cada tabela e escreva <code>apelido.coluna</code>. Funções calculadas precisam de <code>AS nome</code>. Não há <code>SELECT *</code>: liste as colunas.</p></section>
    </div>
    <p className="tech-limit">Demonstração individual com dados fictícios. Para operação hospitalar real: autenticação institucional, perfis, auditoria, retenção, revisão jurídica/LGPD e validação do fluxo com a equipe.</p>
  </div>;
}
