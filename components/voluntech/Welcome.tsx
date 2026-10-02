"use client";

import { useEffect, useRef, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { ButterflyMark } from "./ButterflyMark";
import { ShareQr, useShareBase } from "./ShareQr";

type Staff = { display_name: string; expires_at: string };
export default function Welcome({ onLogin }: { onLogin: (staff: Staff) => void }) {
  // Atalho de demonstração: ?demo=1 só preenche nome e senha públicos; ?demo=auto também entra sozinho.
  // Este componente só é montado no navegador (depois da checagem de sessão), então ler a URL aqui é seguro.
  const [demo] = useState(() => {
    if (typeof window === "undefined") return null;
    const q = new URLSearchParams(window.location.search);
    const mode = q.get("demo");
    return mode === "1" || mode === "auto" ? { name: q.get("nome") || "Equipe", auto: mode === "auto" } : null;
  });
  const [name, setName] = useState(demo?.name ?? "");
  const [password, setPassword] = useState(demo ? "VolunTech2026!" : "");
  const base = useShareBase();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const autoRef = useRef(Boolean(demo?.auto));
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!autoRef.current) return;
    autoRef.current = false;
    formRef.current?.requestSubmit();
  }, []);
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ name, password }) });
      const data = await response.json() as { staff?: Staff; error?: string };
      if (!response.ok || !data.staff) throw new Error(data.error ?? "Não foi possível entrar.");
      onLogin(data.staff);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="welcome-page"><header className="welcome-header"><div className="welcome-brand"><span className="brand-mark"><ButterflyMark size={30} /></span><strong>VolunTech</strong></div><span>Projeto acadêmico · FAM</span></header><main className="welcome-main"><div className="welcome-intro"><p className="eyebrow">VOLUNTARIADO HOSPITALAR</p><h1>Um lugar para acompanhar cada gesto.</h1><p>O VolunTech reúne cadastros, ações, parceiros e doações em uma demonstração fictícia. Visitantes tiram dúvidas em uma página própria; a equipe entra na gestão para explorar as telas e atender a fila.</p><div className="welcome-safety"><ShieldCheck size={21} /> Dados de teste. Nenhum cadastro, doação ou autorização real do hospital.</div><a className="gesture-preview" href="/gesto"><ShareQr path="/gesto" size={86} base={base} alt="QR simbólico que abre uma mensagem sobre o valor de um gesto" /><span><strong>QR de doação simbólica</strong><small>Escaneie com o celular: abre uma mensagem, sem Pix ou cobrança.</small>{base && <code className="share-url">{base}/gesto</code>}</span></a></div><div className="welcome-side"><section className="card login-card"><div className="login-icon"><LockKeyhole size={23} /></div><h2>Entrar na gestão</h2><p>Use seu nome para personalizar a saudação e a senha pública da demonstração.</p><form ref={formRef} onSubmit={(event) => void login(event)}><label>Seu nome<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={40} placeholder="Ex.: Maria" /></label><label>Senha de demonstração<input value={password} onChange={(event) => setPassword(event.target.value)} required type="password" placeholder="Digite a senha abaixo" /></label><small>Senha para a apresentação: <code>VolunTech2026!</code></small>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? "Entrando…" : "Abrir painel"}</button></form><p className="login-note">A conta de teste é pública e não protege dados reais.</p></section><section className="card visitor-card"><h2>Sou visitante</h2><p>Quer tirar uma dúvida sobre como ajudar? Essa página é separada da gestão e não precisa de senha.</p><a className="visitor-card-link" href="/duvidas"><ShareQr path="/duvidas" size={92} color="#9f1763" base={base} alt="QR que abre a página pública de dúvidas" /><span><strong>Tirar uma dúvida</strong><small>Escaneie com o celular ou clique aqui.</small>{base && <code className="share-url">{base}/duvidas</code>}{base === null && <small className="share-hint">Conecte o computador ao Wi-Fi para gerar o QR.</small>}</span></a></section></div></main></div>;
}
