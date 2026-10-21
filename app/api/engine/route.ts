import { guard, json, fail, readBody } from "@/lib/api";
import { engine } from "@/lib/engine";
import { updateData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface EngineAction {
  action?: "start" | "pause" | "run" | "tick" | "stop-all";
  jobId?: string;
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  const body = (await readBody<EngineAction>(request)) ?? {};

  switch (body.action) {
    case "start": {
      await updateData((data) => {
        data.settings.engine.paused = false;
      });
      await engine.ensureStarted();
      await engine.sync();
      return json({ ok: true, paused: false });
    }
    case "pause": {
      await updateData((data) => {
        data.settings.engine.paused = true;
      });
      await engine.sync();
      return json({ ok: true, paused: true });
    }
    case "stop-all": {
      await updateData((data) => {
        data.settings.engine.paused = true;
        for (const job of data.jobs) job.enabled = false;
      });
      await engine.sync();
      return json({ ok: true, paused: true });
    }
    case "run": {
      if (!body.jobId) return fail("Informe o monitor", 422);
      const result = await engine.runOnce(body.jobId);
      if (!result) return fail("Monitor ocupado ou inexistente", 409);
      return json({ ok: true, result });
    }
    case "tick": {
      const result = await engine.tick();
      return json({ ok: true, ...result });
    }
    default:
      return fail("Ação desconhecida", 422);
  }
}
