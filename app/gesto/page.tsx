import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Um gesto faz diferença | VolunTech" };

export default function Gesto() {
  return <main className="gesture-page"><div className="gesture-card"><span className="gesture-heart" aria-hidden="true">♡</span><p className="eyebrow">UM GESTO QUE CONECTA</p><h1>Obrigado por parar um instante para cuidar.</h1><p>Um gesto de atenção, uma conversa, uma canção ou uma doação responsável pode fazer alguém se sentir acompanhado.</p><p className="gesture-note">Este QR faz parte de uma demonstração acadêmica do VolunTech. Nenhum valor foi cobrado, nenhuma chave Pix foi criada e nenhuma doação aconteceu ao escanear.</p><Link className="button primary" href="/">Conhecer o projeto</Link><small>Projeto acadêmico FAM · mensagem fictícia</small></div></main>;
}
