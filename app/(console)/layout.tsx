import { redirect } from "next/navigation";
import { ConsoleProvider } from "@/components/console-provider";
import { ConsoleShell } from "@/components/shell/console-shell";
import { ToastProvider } from "@/components/ui/toast";
import { ensureEngineStarted } from "@/lib/engine";
import { pageAccess } from "@/lib/page-access";
import { buildSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const access = await pageAccess();
  if (!access) redirect("/");

  await ensureEngineStarted();
  const initial = await buildSnapshot(access);

  return (
    <ToastProvider>
      <ConsoleProvider initial={initial}>
        <ConsoleShell>{children}</ConsoleShell>
      </ConsoleProvider>
    </ToastProvider>
  );
}
