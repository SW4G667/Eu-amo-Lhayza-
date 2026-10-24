import { fail, json, readBody } from "@/lib/api";
import { isNextResponse, ownerOf, requireAccess } from "@/lib/access";
import { enabledPlatforms } from "@/lib/cloud/repo";
import { engine } from "@/lib/engine";
import { buildJob, type JobInput } from "@/lib/job-input";
import { readData, updateData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const access = await requireAccess(request);
  if (isNextResponse(access)) return access;

  const { id } = await params;
  const body = await readBody<JobInput>(request);
  if (!body) return fail("Corpo inválido");

  const data = await readData();
  const existing = data.jobs.find((job) => job.id === id);
  if (!existing) return fail("Monitor não encontrado", 404);

  if (access.kind === "user" && existing.owner !== ownerOf(access)) {
    return fail("Esse monitor não é seu.", 403);
  }

  const built = buildJob(body, existing);
  if (!built.ok) return fail(built.error, 422);

  if (built.job.platform !== existing.platform) {
    const enabled = await enabledPlatforms();
    if (!enabled.has(built.job.platform)) {
      return fail(`A plataforma ${built.job.platform} ainda não está liberada. Em breve.`, 423);
    }
  }

  built.job.owner = existing.owner ?? ownerOf(access);

  await updateData((store) => {
    const index = store.jobs.findIndex((job) => job.id === id);
    if (index >= 0) store.jobs[index] = built.job;
  });

  engine.forget(id);
  await engine.sync();
  return json({ job: built.job });
}

export async function DELETE(request: Request, { params }: Params) {
  const access = await requireAccess(request);
  if (isNextResponse(access)) return access;

  const { id } = await params;
  const data = await readData();
  const existing = data.jobs.find((job) => job.id === id);
  if (!existing) return fail("Monitor não encontrado", 404);
  if (access.kind === "user" && existing.owner !== ownerOf(access)) {
    return fail("Esse monitor não é seu.", 403);
  }

  await updateData((store) => {
    store.jobs = store.jobs.filter((job) => job.id !== id);
    store.hits = store.hits.filter((hit) => hit.jobId !== id);
  });
  engine.forget(id);
  await engine.sync();
  return json({ ok: true });
}
