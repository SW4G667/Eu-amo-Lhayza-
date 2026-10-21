import type { ProxyRecord } from "./types";
import type { CheckOutcome } from "./adapters";

export class ProxyPool {
  private records: ProxyRecord[];
  private passwords: Map<string, string>;
  private cursor = 0;

  constructor(records: ProxyRecord[], passwords: Map<string, string>) {
    this.records = records.map((r) => ({ ...r }));
    this.passwords = passwords;
  }

  get size(): number {
    return this.records.filter((r) => r.enabled).length;
  }

  pick(): { record: ProxyRecord; password: string } | null {
    const usable = this.records.filter(
      (r) => r.enabled && r.cooldownUntil <= Date.now()
    );
    if (!usable.length) return null;
    const record = usable[this.cursor % usable.length];
    this.cursor += 1;
    return { record, password: this.passwords.get(record.id) ?? "" };
  }

  report(
    proxy: { record: ProxyRecord; password: string } | null,
    result: CheckOutcome
  ): void {
    if (!proxy) return;
    const record = this.records.find((r) => r.id === proxy.record.id);
    if (!record) return;

    if (result.status === "error" && result.detail.toLowerCase().includes("falha de rede")) {
      record.failures += 1;
      record.ok = false;
      record.lastChecked = Date.now();
      const cooldown = Math.min(10 * 60_000, 30_000 * record.failures);
      record.cooldownUntil = Date.now() + cooldown;
      return;
    }

    if (result.status === "error" || result.status === "unconfigured") return;

    record.failures = 0;
    record.ok = true;
    record.latencyMs = result.latencyMs;
    record.lastChecked = Date.now();
    record.cooldownUntil = 0;
  }

  snapshot(): ProxyRecord[] {
    return this.records.map((r) => ({ ...r }));
  }
}
