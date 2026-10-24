import { json } from "@/lib/api";
import { isNextResponse, ownerOf, requireAccess } from "@/lib/access";
import { logEvent } from "@/lib/cloud/repo";
import { readData, updateData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Logs do console, já filtrados pelo escopo de quem pediu. */
export async function GET(request: Request) {
  const access = await requireAccess(request);
  if (isNextResponse(access)) return access;

  const data = await readData();
  if (access.kind === "admin") return json({ logs: data.logs.slice(0, 150) });

  const ids = new Set(
    data.jobs.filter((job) => job.owner === ownerOf(access)).map((job) => job.id)
  );
  return json({ logs: data.logs.filter((entry) => entry.jobId && ids.has(entry.jobId)).slice(0, 150) });
}

/** "Limpar logs" do console de eventos. */
export async function DELETE(request: Request) {
  const access = await requireAccess(request);
  if (isNextResponse(access)) return access;

  const owner = ownerOf(access);
  let removed = 0;

  await updateData((store) => {
    if (access.kind === "admin") {
      removed = store.logs.length;
      store.logs = [];
      return;
    }
    const ids = new Set(store.jobs.filter((job) => job.owner === owner).map((job) => job.id));
    const before = store.logs.length;
    store.logs = store.logs.filter((entry) => !entry.jobId || !ids.has(entry.jobId));
    removed = before - store.logs.length;
  });

  if (access.kind === "admin") {
    await logEvent({
      kind: "logs.clear",
      severity: "info",
      actor: access.label,
      message: `Console de eventos limpo (${removed} linha(s)).`,
    });
  }

  return json({ ok: true, removed });
}
