import { redirect } from "next/navigation";
import { pageAccess } from "@/lib/page-access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin · Atalaia",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await pageAccess();
  if (!access) redirect("/");
  if (access.kind !== "admin") redirect("/painel");
  return <>{children}</>;
}
