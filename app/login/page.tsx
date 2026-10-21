import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Entrar · Atalaia" };

export default async function LoginPage() {
  if (await isAuthenticated()) redirect("/painel");
  return <LoginForm />;
}
