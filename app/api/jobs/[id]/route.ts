import { fail, guard, json, readBody } from "@/lib/api";
import { engine } from "@/lib/engine";
import { buildJob, type JobInput } from "@/lib/job-input";
import { readData, updateData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const { id } = await params;
  const body = await readBody<JobInput>(request);
  if (!body) return fail("Corpo inválido");

  const data = await readData();
  const existing = data.jobs.find((job) => job.id === id);
  if (!existing) return fail("Monitor não encontrado", 404);

  const built = buildJob(body, existing);
  if (!built.ok) return fail(built.error, 422);

  await updateData((store) => {
    const index = store.jobs.findIndex((job) => job.id === id);
    if (index >= 0) store.jobs[index] = built.job;
  });

  engine.forget(id);
  await engine.sync();
  return json({ job: built.job });
}

export async function DELETE(request: Request, { params }: Params) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const { id } = await params;

  await updateData((store) => {
    store.jobs = store.jobs.filter((job) => job.id !== id);
  });
  engine.forget(id);
  await engine.sync();
  return json({ ok: true });
}
