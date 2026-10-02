import { db } from "./volunteers";

// Senha pública de demonstração. A autorização aqui existe para encenar papéis;
// nunca deve ser reutilizada para dados hospitalares reais.
export const DEMO_PASSWORD = "VolunTech2026!";
const COOKIE = "voluntech_staff";

export type Staff = { token: string; display_name: string; expires_at: string };

export async function staffFromRequest(request: Request): Promise<Staff | null> {
  const token = (request.headers.get("cookie") ?? "").match(/(?:^|;\s*)voluntech_staff=([a-f0-9-]{36})(?:;|$)/)?.[1];
  if (!token) return null;
  const staff = await db().prepare("SELECT token, display_name, expires_at FROM staff_sessions WHERE token = ? AND expires_at > ?")
    .bind(token, new Date().toISOString()).first<Staff>();
  return staff ?? null;
}

export function authCookie(token: string, request: Request, maxAge = 28800) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function forbidden(headers?: Headers) {
  return Response.json({ error: "Entre com a conta de demonstração para acessar a gestão." }, { status: 401, headers });
}
