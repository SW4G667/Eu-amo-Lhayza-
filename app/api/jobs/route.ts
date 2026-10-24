import { fail, json, readBody } from "@/lib/api";
import { isNextResponse, ownerOf, requireAccess } from "@/lib/access";
import { enabledPlatforms, getPlan } from "@/lib/cloud/repo";
import { engine } from "@/lib/engine";
import { buildJob, type JobInput } from "@/lib/job-input";
import { readData, updateData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireAccess(request);
  if (isNextResponse(access)) return access;
  const owner = ownerOf(access);
  const data = await readData();
  const jobs = access.kind === "admin" ? data.jobs : data.jobs.filter((job) => job.owner === owner);
  return json({ jobs });
}

export async function POST(request: Request) {
  const access = await requireAccess(request);
  if (isNextResponse(access)) return access;

  const body = await readBody<JobInput>(request);
  if (!body) return fail("Corpo inválido");

  const built = buildJob(body);
  if (!built.ok) return fail(built.error, 422);

  const enabled = await enabledPlatforms();
  if (!enabled.has(built.job.platform)) {
    return fail(
      `A plataforma ${built.job.platform} ainda não está liberada. Em breve.`,
      423
    );
  }

  const owner = ownerOf(access);
  const data = await readData();
  const mine = access.kind === "admin" ? data.jobs : data.jobs.filter((job) => job.owner === owner);

  let maxMonitors = 30;
  if (access.kind === "user") {
    const plan = access.license?.planId ? await getPlan(access.license.planId) : null;
    maxMonitors = plan?.maxMonitors ?? 1;
  }

  if (mine.length >= maxMonitors) {
    return fail(
      `Seu plano permite ${maxMonitors} monitor(es). Desative ou apague um para criar outro.`,
      409
    );
  }

  built.job.owner = owner;

  await updateData((store) => {
    store.jobs.push(built.job);
    store.logs.unshift({
      id: `log_${Date.now()}`,
      ts: Date.now(),
      jobId: built.job.id,
      level: "info",
      platform: built.job.platform,
      username: null,
      message: `Monitor "${built.job.name}" criado.`,
      latencyMs: null,
      proxy: null,
    });
    store.logs = store.logs.slice(0, 150);
  });

  await engine.sync();
  return json({ job: built.job }, { status: 201 });
}
