"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { renderSVG } from "uqr";

const LOCAL = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
let cached: Promise<string | null> | null = null;

// Endereço base que um celular consegue abrir:
// 1) o que o servidor informa (IP da rede local ou VOLUNTECH_PUBLIC_URL);
// 2) se o site estiver hospedado em um endereço público, o próprio endereço da página;
// 3) nenhum (computador sem rede): o QR não é exibido.
function loadBase(): Promise<string | null> {
  cached ??= fetch("/api/network", { cache: "no-store", credentials: "same-origin" })
    .then((response) => (response.ok ? (response.json() as Promise<{ base?: string | null }>) : { base: null }))
    .catch(() => ({ base: null }))
    .then(({ base }) => base || (LOCAL.has(window.location.hostname) ? null : window.location.origin));
  return cached;
}

/** undefined = carregando · null = sem endereço compartilhável · string = endereço base. */
export function useShareBase() {
  const [base, setBase] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void loadBase().then((value) => { if (alive) setBase(value); });
    return () => { alive = false; };
  }, []);
  return base;
}

type Props = { path: string; size: number; alt: string; color?: string; base?: string | null };

export function ShareQr({ path, size, alt, color = "#000000", base }: Props) {
  const own = useShareBase();
  const resolved = base === undefined ? own : base;
  if (!resolved) {
    return (
      <span className="qr-placeholder" style={{ width: size, height: size }} role="img" aria-label={resolved === undefined ? "Gerando QR Code" : "QR Code indisponível sem rede"}>
        {resolved === undefined ? "…" : "Sem rede"}
      </span>
    );
  }
  const svg = renderSVG(resolved + path, { border: 1, blackColor: color, whiteColor: "#ffffff" });
  return <Image unoptimized src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} width={size} height={size} alt={alt} />;
}
