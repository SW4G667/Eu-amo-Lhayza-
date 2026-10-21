import { fail, guard, json, readBody } from "@/lib/api";
import { engine } from "@/lib/engine";
import { buildJob, type JobInput } from "@/lib/job-input";
import { readData, updateData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const data = await readData();
  return json({ jobs: data.jobs });
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const body = await readBody<JobInput>(request);
  if (!body) return fail("Corpo inválido");

  const built = buildJob(body);
  if (!built.ok) return fail(built.error, 422);

  const data = await readData();
  if (data.jobs.length >= 30) return fail("Limite de 30 monitores atingido", 409);

  await updateData((store) => {
    store.jobs.push(built.job);
    store.logs.unshift({
      id: `log_${Date.now()}`,
      ts: Date.now(),
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
