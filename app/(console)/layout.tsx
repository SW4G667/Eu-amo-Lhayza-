import { ConsoleProvider } from "@/components/console-provider";
import { ConsoleShell } from "@/components/shell/console-shell";
import { ToastProvider } from "@/components/ui/toast";
import { requirePageAuth } from "@/lib/auth";
import { ensureEngineStarted } from "@/lib/engine";
import { buildSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  await requirePageAuth();
  await ensureEngineStarted();
  const initial = await buildSnapshot();

  return (
    <ToastProvider>
      <ConsoleProvider initial={initial}>
        <ConsoleShell>{children}</ConsoleShell>
      </ConsoleProvider>
    </ToastProvider>
  );
}
