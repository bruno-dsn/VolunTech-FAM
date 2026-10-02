import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import { ensureMigrated } from "../lib/migrate";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

type ShareEnv = Cloudflare.Env & { VOLUNTECH_LAN?: string; VOLUNTECH_PUBLIC_URL?: string };

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
// O que um visitante pode abrir pelo QR Code (endereço da rede). A gestão continua só no próprio computador.
const GUEST_ROUTES = /^\/(duvidas|gesto)(\.rsc)?\/?$|^\/api\/chat\/?$/;

// Rede local ligada: quem acessa pelo IP do computador (celular do QR) vê só as páginas públicas.
// Isso evita expor por engano a tela de login e o painel; não substitui autenticação de verdade.
function guestGate(request: Request, env: ShareEnv): Response | null {
  if (env.VOLUNTECH_LAN !== "1") return null;
  const url = new URL(request.url);
  if (LOCAL_HOSTS.has(url.hostname) || GUEST_ROUTES.test(url.pathname)) return null;
  if (request.method === "GET" || request.method === "HEAD") return Response.redirect(new URL("/duvidas", url).href, 302);
  return Response.json({ error: "Esta área só abre no computador que está executando o VolunTech." }, { status: 403 });
}

export default {
  async fetch(request: Request, env: ShareEnv, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    // Garante que as tabelas existam antes de qualquer rota usar o banco.
    if (env.DB) await ensureMigrated(env.DB);
    // Endereço que o QR Code deve usar (definido por scripts/electron-server.mjs).
    if (new URL(request.url).pathname === "/api/network" && LOCAL_HOSTS.has(new URL(request.url).hostname)) {
      return Response.json({ base: env.VOLUNTECH_PUBLIC_URL || null }, { headers: { "Cache-Control": "no-store" } });
    }
    const blocked = guestGate(request, env);
    if (blocked) return blocked;
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};
