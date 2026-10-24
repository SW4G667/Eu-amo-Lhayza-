import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = { title: "Entrar · Atalaia" };

/** A entrada agora é a porta única em `/` (Discord ou key). */
export default function LoginPage() {
  redirect("/");
}
