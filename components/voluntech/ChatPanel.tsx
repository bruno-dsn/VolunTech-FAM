"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";

type Ticket = { id: number; guest_name: string; status: string };
type Message = { sender: string; body: string; created_at: string };
type ChatState = { ticket: Ticket | null; messages: Message[]; position: number; answer?: string; topic?: string; handoff?: boolean; error?: string };
const examples = ["Como funcionam as etapas para barbearia?", "Como posso doar alimentos?", "O QR é um Pix?", "Quero falar com uma atendente"];

async function fetchChat(init?: RequestInit) {
  const response = await fetch("/api/chat", { credentials: "same-origin", cache: "no-store", ...init });
  const data = await response.json() as ChatState;
  if (!response.ok) throw new Error(data.error ?? "Não foi possível conversar agora.");
  return data;
}

export default function ChatPanel({ compact = false, standalone = false }: { compact?: boolean; standalone?: boolean }) {
  const [state, setState] = useState<ChatState>({ ticket: null, messages: [], position: 0 });
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Quando a atendente encerra, o servidor já não devolve o chamado: guardamos a conversa para a pessoa não ficar com a tela vazia.
  const [ended, setEnded] = useState<Message[] | null>(null);
  const lastTicket = useRef<{ ticket: Ticket; messages: Message[] } | null>(null);
  useEffect(() => {
    let live = true;
    const poll = () => fetchChat().then((data) => {
      if (!live) return;
      if (data.ticket) lastTicket.current = { ticket: data.ticket, messages: data.messages };
      else if (lastTicket.current) { setEnded(lastTicket.current.messages); lastTicket.current = null; }
      setState((previous) => ({ ...data, answer: previous.answer, topic: previous.topic }));
    }).catch(() => {});
    void poll(); const interval = setInterval(poll, 5000);
    return () => { live = false; clearInterval(interval); };
  }, []);
  async function submit(message = question) {
    if (!message.trim()) return;
    setBusy(true); setError("");
    try {
      const data = await fetchChat({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: state.ticket ? "send" : "ask", message, name: name || "Visitante" }) });
      setState(data); setQuestion(""); setEnded(null);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  async function close() {
    setBusy(true);
    try { lastTicket.current = null; setState(await fetchChat({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close" }) })); setError(""); setEnded(null); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  return <section className={`card public-chat ${compact ? "compact" : ""} ${standalone ? "standalone" : ""}`}><div className="chat-head"><span className="assistant-icon"><MessageCircle size={21} /></span><div><h2>Tire sua dúvida</h2><p>Respostas sobre o fluxo proposto e uma fila para falar com a equipe.</p></div></div>
    <p className="chat-disclaimer">Não envie CPF, contato, dados de pacientes ou informações reais. As respostas são gerais e precisam ser confirmadas pelo hospital.</p>
    {!state.ticket && !ended && <div className="chat-examples">{examples.map((example) => <button key={example} onClick={() => void submit(example)} disabled={busy}>{example}</button>)}</div>}
    {state.answer && <div className="chat-answer" aria-live="polite"><strong>{state.topic ?? "VolunTech responde"}</strong><p>{state.answer}</p></div>}
    {state.ticket && <><div className="queue-status" role="status">{state.ticket.status === "waiting" ? `Na fila · posição ${state.position}. Uma atendente responderá quando estiver disponível.` : "Atendimento em andamento com a equipe de demonstração."}<button aria-label="Encerrar conversa" title="Encerrar conversa" onClick={() => void close()}><X size={16} /></button></div><div className="chat-messages" aria-live="polite">{state.messages.map((item, index) => <div key={index} className={`chat-bubble ${item.sender === "attendant" ? "from-team" : "from-visitor"}`}><small>{item.sender === "attendant" ? "Equipe" : "Você"}</small>{item.body}</div>)}</div></>}
    {!state.ticket && ended && <div className="chat-ended" role="status"><strong>Atendimento encerrado.</strong> Obrigado por conversar com a equipe.<div className="chat-messages">{ended.map((item, index) => <div key={index} className={`chat-bubble ${item.sender === "attendant" ? "from-team" : "from-visitor"}`}><small>{item.sender === "attendant" ? "Equipe" : "Você"}</small>{item.body}</div>)}</div><button className="button outline" onClick={() => { setEnded(null); setState({ ticket: null, messages: [], position: 0 }); }}>Fazer nova pergunta</button></div>}
    {!state.ticket && !ended && <label className="chat-name">Como podemos chamar você? <input value={name} onChange={(event) => setName(event.target.value.slice(0, 40))} placeholder="Nome de demonstração (opcional)" /></label>}
    {(state.ticket || !ended) && <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); void submit(); }}><input aria-label="Escreva sua dúvida" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={400} placeholder={state.ticket ? "Escreva para a atendente" : "Ex.: como doar alimentos?"} /><button aria-label="Enviar dúvida" disabled={busy || question.trim().length < 3}><Send size={18} /></button></form>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <small className="chat-foot">Busca por assunto e sinônimos, sem IA generativa. Se faltar uma resposta, a dúvida entra automaticamente na fila.</small>
  </section>;
}
