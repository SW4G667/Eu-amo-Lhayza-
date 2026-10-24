import { cookies } from "next/headers";
import { resolveAccess, type Access } from "./access";

/**
 * Lê a sessão a partir dos cookies no servidor (Server Components).
 * Reaproveita exatamente a mesma resolução usada pelas rotas de API.
 */
export async function pageAccess(): Promise<Access | null> {
  const store = await cookies();
  const cookieHeader = store
    .getAll()
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join("; ");

  const request = new Request("http://atalaia.local/", {
    headers: { cookie: cookieHeader },
  });

  return resolveAccess(request);
}
