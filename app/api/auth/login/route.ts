import { NextResponse } from "next/server";
import {
  checkPassword,
  clearLoginAttempts,
  clientIp,
  createSessionToken,
  loginAllowed,
  registerFailedLogin,
  sessionCookie,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!loginAllowed(ip)) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em 10 minutos." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password || !checkPassword(password)) {
    registerFailedLogin(ip);
    await new Promise((resolve) => setTimeout(resolve, 320));
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  clearLoginAttempts(ip);
  const cookie = sessionCookie(createSessionToken());
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
