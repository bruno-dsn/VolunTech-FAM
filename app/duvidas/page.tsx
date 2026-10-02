import type { Metadata } from "next";
import Link from "next/link";
import ChatPanel from "../../components/voluntech/ChatPanel";
import { ButterflyMark } from "../../components/voluntech/ButterflyMark";

export const metadata: Metadata = { title: "Tire sua dúvida | VolunTech" };

// Página pública do visitante: sem login, pensada para abrir no celular (QR) e separada do painel da equipe.
export default function Duvidas() {
  return <main className="visitor-page"><header className="visitor-head"><span className="brand-mark"><ButterflyMark size={30} /></span><div><strong>VolunTech</strong><small>Voluntariado hospitalar · demonstração</small></div></header><ChatPanel standalone /><p className="visitor-foot">Você está na página do <strong>visitante</strong>. A equipe responde em outra tela, dentro do painel de gestão. <Link href="/">Sou da equipe</Link></p></main>;
}
