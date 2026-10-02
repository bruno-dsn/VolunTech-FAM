"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Bell, BellOff, ExternalLink, Send, UsersRound } from "lucide-react";

type Ticket = { id: number; guest_name: string; created_at: string; first_message?: string | null };
type Closed = { id: number; guest_name: string; updated_at: string; first_message?: string | null };
type Message = { sender: string; body: string; created_at: string };
type State = { queue: Ticket[]; active: Ticket | null; mine: boolean; messages: Message[]; history?: Closed[]; error?: string };
const initial: State = { queue: [], active: null, mine: false, messages: [], history: [] };
const quickReplies = ["Olá! Já vou te ajudar.", "Essa regra é definida pelo hospital; vou confirmar com o setor.", "Pode me passar mais detalhes da ação?", "Obrigada pelo contato! Posso ajudar em mais alguma coisa?"];
async function call(init?: RequestInit) {
  const response = await fetch("/api/chat/operator", { credentials: "same-origin", cache: "no-store", ...init });
  const data = await response.json() as State;
  if (!response.ok) throw new Error(data.error ?? "Atendimento indisponível.");
  return data;
}

export default function OperatorPanel() {
  const [state, setState] = useState<State>(initial);
  const [message, setMessage] = useState("");
  const [sound, setSound] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const previousCount = useRef<number | null>(null);
  const previousVisitorMessages = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => {
    let live = true;
    const beep = (frequency: number) => {
      const context = audio.current; if (!context) return;
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = "sine"; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0.08, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.25);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.26);
    };
    const poll = () => call().then((data) => {
      if (!live) return;
      // Som agudo: nova pessoa na fila. Som grave: o visitante respondeu na conversa que você está atendendo.
      if (previousCount.current !== null && data.queue.length > previousCount.current) beep(660);
      const visitorMessages = data.messages.filter((item) => item.sender === "visitor").length;
      if (data.mine && previousVisitorMessages.current !== null && visitorMessages > previousVisitorMessages.current) beep(440);
      previousVisitorMessages.current = data.mine ? visitorMessages : null;
      previousCount.current = data.queue.length; setState(data);
    }).catch(() => {});
    void poll(); const interval = setInterval(poll, 4000);
    return () => { live = false; clearInterval(interval); };
  }, []);
  async function mutate(action: string, text?: string) {
    setBusy(true); setError("");
    try {
      const data = await call({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, message: text }) });
      setState(data); previousCount.current = data.queue.length; if (action === "send") setMessage("");
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  async function toggleSound() {
    if (sound) { await audio.current?.close(); audio.current = null; setSound(false); return; }
    audio.current = new AudioContext(); await audio.current.resume(); setSound(true);
  }
  return <div className="secondary-page operations-page"><p className="eyebrow">VOLUNTECH · ATENDIMENTO DE DEMONSTRAÇÃO</p><div className="page-heading"><div><h1>Fila de dúvidas</h1><p className="subline">Uma conversa por vez. Ao encerrar, a próxima pessoa pode ser atendida.</p></div><button className="button outline" onClick={() => void toggleSound()}>{sound ? <Bell size={18} /> : <BellOff size={18} />}{sound ? "Som ligado" : "Ativar aviso sonoro"}</button></div><div className="notice"><UsersRound size={20} /> O aviso sonoro funciona enquanto esta página está aberta e depois de ativado por um clique. Use apenas mensagens fictícias.</div>{error && <p className="ops-feedback error" role="alert">{error}</p>}
    <div className="ops-columns"><section className="card ops-card"><h2>Aguardando · {state.queue.length}</h2>{state.queue.length ? state.queue.map((ticket, index) => <div className="compact-row" key={ticket.id}><div><strong>{index + 1}. {ticket.guest_name}</strong><small>Solicitação #{ticket.id}</small>{ticket.first_message && <p className="queue-preview">“{ticket.first_message}”</p>}</div></div>) : <p>Nenhuma pessoa na fila agora.</p>}<button className="button primary" disabled={busy || !!state.active || !state.queue.length} onClick={() => void mutate("claim")}>Atender próxima pessoa</button></section><section className="card ops-card"><h2>{state.active ? `Conversa com ${state.active.guest_name}` : "Conversa disponível"}</h2>{state.active && !state.mine && <p>Outra atendente já está conversando. Aguarde o encerramento.</p>}{state.active && <><div className="chat-messages operator-messages">{state.messages.map((item, index) => <div className={`chat-bubble ${item.sender === "attendant" ? "from-team" : "from-visitor"}`} key={index}><small>{item.sender === "attendant" ? "Equipe" : "Visitante"}</small>{item.body}</div>)}</div>{state.mine && <><form className="chat-compose" onSubmit={(event) => { event.preventDefault(); void mutate("send", message); }}><input aria-label="Resposta da atendente" maxLength={400} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escreva uma resposta de demonstração" /><button aria-label="Enviar resposta" disabled={busy || message.trim().length < 2}><Send size={18} /></button></form><div className="quick-replies" aria-label="Respostas prontas">{quickReplies.map((reply) => <button type="button" key={reply} onClick={() => setMessage(reply)}>{reply}</button>)}</div><button className="button outline" disabled={busy} onClick={() => void mutate("close")}>Encerrar e liberar a fila</button></>}</>}{!state.active && <p>Selecione <strong>Atender próxima pessoa</strong> quando alguém entrar na fila.</p>}</section></div>
    <div className="ops-columns"><section className="card ops-card visitor-channel"><h2>Canal do visitante</h2><p>Quem pergunta usa uma página própria, sem login, separada deste painel. Abra no celular ou imprima o QR para o cartaz do setor.</p><div className="visitor-channel-body"><Image src="/qr-duvidas.svg" width={112} height={112} alt="QR que abre a página pública de dúvidas" /><div><a className="button outline" href="/duvidas" target="_blank" rel="noreferrer"><ExternalLink size={16} /> Abrir página do visitante</a><small>Dica para a apresentação: abra essa página no celular e responda por aqui, no computador.</small></div></div></section><section className="card ops-card"><h2>Dúvidas que o assistente não soube responder</h2>{state.history?.length ? state.history.map((item) => <div className="compact-row" key={item.id}><div><strong>{item.guest_name}</strong><p className="queue-preview">“{item.first_message ?? "—"}”</p></div></div>) : <p>Ainda não há histórico. Cada pergunta encaminhada aparece aqui para virar uma resposta nova na base.</p>}</section></div>
  </div>;
}
