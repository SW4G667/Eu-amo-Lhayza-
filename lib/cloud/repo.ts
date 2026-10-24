import crypto from "crypto";
import { platformMeta } from "../platforms";
import type { PlatformId } from "../types";
import { table, newId, driver, driverLabel, type Row } from "./db";
import {
  codePrefix,
  decryptCode,
  encryptCode,
  generateCode,
  hashCode,
} from "./keys";
import {
  DEFAULT_SETTINGS,
  type AuditEvent,
  type CloudProxy,
  type CloudUser,
  type EventSeverity,
  type License,
  type LicenseStatus,
  type Plan,
  type PlatformState,
  type SettingsKey,
  type SettingsMap,
} from "./types";

/* ------------------------------- planos ------------------------------- */

export async function listPlans(): Promise<Plan[]> {
  const rows = await table("plans").all({ order: "sort.asc" });
  return (rows as unknown as Plan[]).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

export async function getPlan(id: string): Promise<Plan | null> {
  const plans = await listPlans();
  return plans.find((plan) => plan.id === id) ?? null;
}

export async function savePlan(input: Partial<Plan> & { id?: string; name: string }): Promise<Plan> {
  const id =
    input.id ||
    input.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) ||
    newId("plan");

  const plan: Plan = {
    id,
    name: input.name,
    days: clampInt(input.days, 30, 1, 3650),
    maxMonitors: clampInt(input.maxMonitors, 2, 1, 30),
    maxChecksDay: clampInt(input.maxChecksDay, 5000, 100, 200000),
    priceCents: clampInt(input.priceCents, 0, 0, 100000000),
    active: input.active ?? true,
    sort: clampInt(input.sort, 99, 0, 999),
    createdAt: input.createdAt ?? Date.now(),
  };
  await table("plans").upsert([plan as unknown as Row], "id");
  return plan;
}

export async function deletePlan(id: string): Promise<void> {
  await table("plans").remove(id);
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/* ------------------------------ licenças ------------------------------ */

export async function listLicenses(): Promise<License[]> {
  const rows = await table("licenses").all({ limit: 800 });
  const now = Date.now();
  return (rows as unknown as License[]).map((license) => withEffectiveStatus(license, now));
}

function withEffectiveStatus(license: License, now = Date.now()): License {
  if (license.status === "active" && license.expiresAt && license.expiresAt < now) {
    return { ...license, status: "expired" };
  }
  return license;
}

export async function getLicenseById(id: string): Promise<License | null> {
  const rows = await table("licenses").all({ limit: 800 });
  const found = (rows as unknown as License[]).find((license) => license.id === id);
  return found ? withEffectiveStatus(found) : null;
}

export async function getLicenseByCode(code: string): Promise<License | null> {
  const hash = hashCode(code);
  const rows = await table("licenses").all({ limit: 800 });
  const found = (rows as unknown as License[]).find((license) => license.codeHash === hash);
  return found ? withEffectiveStatus(found) : null;
}

export async function getLicenseForDiscord(discordId: string): Promise<License | null> {
  if (!discordId) return null;
  const rows = await table("licenses").all({ limit: 800 });
  const now = Date.now();
  const owned = (rows as unknown as License[])
    .filter((license) => license.discordId === discordId)
    .map((license) => withEffectiveStatus(license, now))
    .sort((a, b) => (b.expiresAt ?? 0) - (a.expiresAt ?? 0));
  return owned.find((license) => license.status === "active") ?? owned[0] ?? null;
}

export interface CreateLicensesInput {
  quantity: number;
  planId: string;
  days?: number;
  note?: string;
  createdBy: string;
  maxActivations?: number;
}

export async function createLicenses(input: CreateLicensesInput): Promise<{ licenses: License[]; codes: string[] }> {
  const settings = await getSettings();
  const plan = (await getPlan(input.planId)) ?? null;
  const quantity = clampInt(input.quantity, 1, 1, 200);
  const days = clampInt(input.days ?? plan?.days, settings.limits.defaultDays || 30, 1, 3650);
  const maxActivations = clampInt(
    input.maxActivations ?? settings.limits.maxActivations,
    2,
    1,
    10
  );

  const licenses: License[] = [];
  const codes: string[] = [];
  const now = Date.now();

  for (let index = 0; index < quantity; index += 1) {
    const code = generateCode("ATL");
    codes.push(code);
    licenses.push({
      id: newId("lic"),
      codeHash: hashCode(code),
      codeEnc: encryptCode(code),
      codePrefix: codePrefix(code),
      planId: plan?.id ?? input.planId ?? null,
      status: "pending",
      days,
      discordId: null,
      discordUsername: null,
      deviceHash: null,
      activations: 0,
      maxActivations,
      activatedAt: null,
      expiresAt: null,
      revokedAt: null,
      revokedReason: null,
      note: input.note?.trim() || null,
      createdBy: input.createdBy,
      createdAt: now + index,
      lastSeenAt: null,
    });
  }

  await table("licenses").upsert(licenses as unknown as Row[], "id");
  return { licenses, codes };
}

export async function updateLicense(id: string, patch: Partial<License>): Promise<License | null> {
  const existing = await getLicenseById(id);
  if (!existing) return null;
  const clean: Row = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) clean[key] = value;
  }
  await table("licenses").update(id, clean);
  return getLicenseById(id);
}

export async function revealLicenseCode(id: string, actor: string): Promise<string | null> {
  const license = await getLicenseById(id);
  if (!license) return null;
  const code = decryptCode(license.codeEnc);
  await logEvent({
    kind: "license.reveal",
    severity: "warn",
    actor,
    licenseId: id,
    message: `Código da licença ${license.codePrefix} foi revelado.`,
  });
  return code || null;
}

export async function revokeLicense(id: string, reason: string, actor: string): Promise<License | null> {
  const updated = await updateLicense(id, {
    status: "revoked",
    revokedAt: Date.now(),
    revokedReason: reason || "Revogada pelo administrador",
  });
  await logEvent({
    kind: "license.revoke",
    severity: "danger",
    actor,
    licenseId: id,
    message: `Licença revogada: ${reason || "sem motivo informado"}.`,
  });
  return updated;
}

export async function suspendLicense(id: string, actor: string, suspended: boolean): Promise<License | null> {
  const license = await getLicenseById(id);
  if (!license) return null;
  const status: LicenseStatus = suspended ? "suspended" : license.activatedAt ? "active" : "pending";
  const updated = await updateLicense(id, { status });
  await logEvent({
    kind: suspended ? "license.suspend" : "license.resume",
    severity: suspended ? "warn" : "success",
    actor,
    licenseId: id,
    message: suspended ? "Licença suspensa." : "Licença reativada.",
  });
  return updated;
}

export async function extendLicense(id: string, days: number, actor: string): Promise<License | null> {
  const license = await getLicenseById(id);
  if (!license) return null;
  const extra = clampInt(days, 30, 1, 3650);
  const base = license.expiresAt && license.expiresAt > Date.now() ? license.expiresAt : Date.now();
  const updated = await updateLicense(id, {
    days: license.days + extra,
    expiresAt: license.activatedAt ? base + extra * 86400000 : null,
    status: license.status === "expired" ? "active" : license.status,
  });
  await logEvent({
    kind: "license.extend",
    severity: "success",
    actor,
    licenseId: id,
    message: `Licença estendida em ${extra} dias.`,
  });
  return updated;
}

export async function deleteLicense(id: string, actor: string): Promise<void> {
  await table("licenses").remove(id);
  await logEvent({
    kind: "license.delete",
    severity: "danger",
    actor,
    licenseId: id,
    message: "Licença apagada permanentemente.",
  });
}

/** Marca como expiradas as licenças cuja data passou. */
export async function expireDueLicenses(): Promise<number> {
  const licenses = await listLicenses();
  const now = Date.now();
  const due = licenses.filter(
    (license) => license.status === "active" && license.expiresAt && license.expiresAt < now
  );
  for (const license of due) {
    await table("licenses").update(license.id, { status: "expired" });
  }
  return due.length;
}

/* ----------------------------- ativação ------------------------------ */

export type ActivationReason =
  | "invalid"
  | "discord_required"
  | "banned"
  | "revoked"
  | "suspended"
  | "expired"
  | "bound"
  | "guild_required"
  | "ok";

export interface ActivationResult {
  ok: boolean;
  reason: ActivationReason;
  license?: License;
  message: string;
}

export function deviceHashOf(userAgent: string, ip: string): string {
  return crypto
    .createHash("sha256")
    .update(`${userAgent}|${ip}|atalaia`)
    .digest("hex")
    .slice(0, 32);
}

export async function activateLicense(input: {
  code: string;
  discordId: string | null;
  discordUsername?: string | null;
  deviceHash: string;
  ip: string;
  /** Permite ativar a key sem Discord quando o admin desliga essa exigência. */
  allowAnonymous?: boolean;
}): Promise<ActivationResult> {
  const license = await getLicenseByCode(input.code);
  if (!license) {
    return { ok: false, reason: "invalid", message: "Key inválida. Confira os caracteres e tente de novo." };
  }

  if (license.status === "revoked") {
    return { ok: false, reason: "revoked", message: "Esta key foi revogada.", license };
  }
  if (license.status === "suspended") {
    return { ok: false, reason: "suspended", message: "Esta key está suspensa. Fale com o suporte.", license };
  }
  if (license.status === "expired") {
    return { ok: false, reason: "expired", message: "Esta key expirou.", license };
  }
  if (!input.discordId && !input.allowAnonymous) {
    return {
      ok: false,
      reason: "discord_required",
      message: "Conecte sua conta do Discord para ativar esta key.",
      license,
    };
  }

  if (license.discordId && license.discordId !== input.discordId && license.activations >= license.maxActivations) {
    return {
      ok: false,
      reason: "bound",
      message: "Esta key já está vinculada a outra conta do Discord.",
      license,
    };
  }

  const now = Date.now();
  if (license.status === "pending") {
    const updated = await updateLicense(license.id, {
      status: "active",
      discordId: input.discordId,
      discordUsername: input.discordUsername ?? null,
      deviceHash: input.deviceHash,
      activations: 1,
      activatedAt: now,
      expiresAt: now + license.days * 86400000,
      lastSeenAt: now,
    });
    await logEvent({
      kind: "license.activate",
      severity: "success",
      actor: input.discordUsername ?? input.discordId ?? "key",
      licenseId: license.id,
      discordId: input.discordId,
      ip: input.ip,
      message: `Key ativada (${license.days} dias).`,
    });
    return {
      ok: true,
      reason: "ok",
      license: updated ?? undefined,
      message: `Key ativada! Você tem ${license.days} dias de acesso.`,
    };
  }

  const rebind = license.discordId !== input.discordId;
  const updated = await updateLicense(license.id, {
    discordId: input.discordId,
    discordUsername: input.discordUsername ?? license.discordUsername,
    deviceHash: input.deviceHash,
    lastSeenAt: now,
    ...(rebind ? { activations: license.activations + 1 } : {}),
  });
  if (rebind) {
    await logEvent({
      kind: "license.rebind",
      severity: "warn",
      actor: input.discordUsername ?? input.discordId,
      licenseId: license.id,
      discordId: input.discordId,
      ip: input.ip,
      message: `Key vinculada a uma nova conta (${license.activations + 1}/${license.maxActivations}).`,
    });
  }
  return { ok: true, reason: "ok", license: updated ?? undefined, message: "Key validada." };
}

/* ------------------------------ usuários ------------------------------ */

export async function listUsers(): Promise<CloudUser[]> {
  const rows = await table("users").all({ limit: 800 });
  return (rows as unknown as CloudUser[]).sort((a, b) => (b.lastLoginAt ?? 0) - (a.lastLoginAt ?? 0));
}

export async function upsertDiscordUser(profile: {
  discordId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
}): Promise<CloudUser> {
  const users = await listUsers();
  const existing = users.find((user) => user.discordId === profile.discordId);
  const license = await getLicenseForDiscord(profile.discordId);
  const now = Date.now();
  if (existing) {
    await table("users").update(existing.id, {
      username: profile.username,
      globalName: profile.globalName,
      avatar: profile.avatar,
      licenseId: license?.id ?? existing.licenseId,
      lastLoginAt: now,
    });
    return { ...existing, ...profile, licenseId: license?.id ?? existing.licenseId, lastLoginAt: now };
  }
  const user: CloudUser = {
    id: newId("usr"),
    discordId: profile.discordId,
    username: profile.username,
    globalName: profile.globalName,
    avatar: profile.avatar,
    licenseId: license?.id ?? null,
    role: "user",
    banned: false,
    createdAt: now,
    lastLoginAt: now,
  };
  await table("users").insert(user as unknown as Row);
  return user;
}

export async function setUserBanned(id: string, banned: boolean, actor: string): Promise<void> {
  await table("users").update(id, { banned });
  await logEvent({
    kind: banned ? "user.ban" : "user.unban",
    severity: banned ? "danger" : "success",
    actor,
    message: banned ? "Usuário banido." : "Usuário liberado.",
  });
}

/* ------------------------------ auditoria ----------------------------- */

export async function logEvent(input: {
  kind: string;
  severity?: EventSeverity;
  actor?: string | null;
  licenseId?: string | null;
  discordId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  message: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const event: AuditEvent = {
    id: newId("evt"),
    kind: input.kind,
    severity: input.severity ?? "info",
    actor: input.actor ?? null,
    licenseId: input.licenseId ?? null,
    discordId: input.discordId ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ? input.userAgent.slice(0, 220) : null,
    message: input.message,
    meta: input.meta ?? {},
    createdAt: Date.now(),
  };
  try {
    await table("events").insert(event as unknown as Row);
  } catch {
    /* auditoria nunca derruba a operação principal */
  }
}

export async function listEvents(limit = 120): Promise<AuditEvent[]> {
  const rows = await table("events").all({ limit, order: "created_at.desc" });
  return (rows as unknown as AuditEvent[]).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

/* ---------------------------- configuração ---------------------------- */

export async function getSettings(): Promise<SettingsMap> {
  const rows = await table("settings").all({ limit: 50, order: "key.asc" });
  const stored = new Map<string, unknown>();
  for (const row of rows) stored.set(String(row.key), row.value);
  const merged: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingsKey[]) {
    merged[key] = {
      ...DEFAULT_SETTINGS[key],
      ...((stored.get(key) as object | undefined) ?? {}),
    };
  }
  return merged as unknown as SettingsMap;
}

export async function setSetting<K extends SettingsKey>(key: K, value: Partial<SettingsMap[K]>): Promise<SettingsMap> {
  const current = await getSettings();
  const next = { ...current[key], ...value };
  await table("settings").upsert([{ key, value: next, updatedAt: Date.now() } as Row], "key");
  return { ...current, [key]: next } as SettingsMap;
}

/* ----------------------------- plataformas ---------------------------- */

const PLATFORM_ORDER = [
  "discord",
  "tiktok",
  "instagram",
  "github",
  "telegram",
  "twitch",
  "steam",
  "roblox",
  "youtube",
  "reddit",
  "pinterest",
];

export async function listPlatforms(): Promise<PlatformState[]> {
  const rows = (await table("platforms").all({ limit: 50, order: "id.asc" })) as unknown as PlatformState[];
  return rows
    .map((row) => {
      const meta = platformMeta(row.id as PlatformId);
      return {
        ...row,
        name: meta.name,
        short: meta.short,
        accent: meta.accent,
        note: (row.note as string | null) || (row.enabled ? "" : "Em breve"),
      };
    })
    .sort(
      (a, b) =>
        (PLATFORM_ORDER.indexOf(a.id) + 1 || 99) - (PLATFORM_ORDER.indexOf(b.id) + 1 || 99)
    );
}

export async function setPlatform(
  id: string,
  patch: { enabled?: boolean; note?: string },
  actor: string
): Promise<void> {
  await table("platforms").upsert(
    [
      {
        id,
        enabled: patch.enabled ?? false,
        note: patch.note ?? "",
        updatedAt: Date.now(),
      } as Row,
    ],
    "id"
  );
  await logEvent({
    kind: "platform.update",
    severity: "info",
    actor,
    message: `Plataforma ${id} ${patch.enabled ? "ativada" : "desativada"}.`,
  });
}

export async function enabledPlatforms(): Promise<Set<string>> {
  const platforms = await listPlatforms();
  return new Set(platforms.filter((platform) => platform.enabled).map((platform) => platform.id));
}

/* ------------------------------- proxies ------------------------------ */

export async function listProxies(limit = 400): Promise<CloudProxy[]> {
  const rows = await table("proxies").all({ limit, order: "created_at.desc" });
  return rows as unknown as CloudProxy[];
}

export async function addProxies(rows: Omit<CloudProxy, "id" | "createdAt">[]): Promise<number> {
  if (!rows.length) return 0;
  const now = Date.now();
  const payload = rows.map((row) => ({
    ...row,
    id: newId("prx"),
    createdAt: now,
  })) as unknown as Row[];
  await table("proxies").upsert(payload, "host,port,protocol");
  return payload.length;
}

export async function updateProxy(id: string, patch: Partial<CloudProxy>): Promise<void> {
  await table("proxies").update(id, patch as Row);
}

export async function updateProxyStatus(
  id: string,
  status: CloudProxy["status"],
  latencyMs: number | null
): Promise<void> {
  await table("proxies").update(id, {
    status,
    latencyMs,
    lastCheckedAt: Date.now(),
  } as Row);
}

export async function deleteProxy(id: string): Promise<void> {
  await table("proxies").remove(id);
}

/* ----------------------------- rate limit ----------------------------- */

export async function recentAttempts(bucket: string, windowMs: number): Promise<number> {
  const rows = await table("attempts").all({ limit: 500, order: "created_at.desc" });
  const since = Date.now() - windowMs;
  return (rows as unknown as { bucket: string; createdAt: number }[]).filter(
    (row) => row.bucket === bucket && row.createdAt >= since
  ).length;
}

export async function recordAttempt(bucket: string, kind: string, ok: boolean, ip: string): Promise<void> {
  try {
    await table("attempts").insert({
      id: newId("att"),
      bucket,
      kind,
      ok,
      ip,
      createdAt: Date.now(),
    } as Row);
  } catch {
    /* nunca bloqueia o fluxo */
  }
}

export async function pruneAttempts(): Promise<void> {
  const rows = await table("attempts").all({ limit: 500 });
  const cutoff = Date.now() - 86400000;
  const stale = (rows as unknown as { id: string; createdAt: number }[]).filter(
    (row) => row.createdAt < cutoff
  );
  for (const row of stale.slice(0, 200)) {
    await table("attempts").remove(row.id);
  }
}

/* ------------------------------- resumo ------------------------------- */

export interface CloudOverview {
  driver: string;
  totalLicenses: number;
  pending: number;
  active: number;
  expired: number;
  revoked: number;
  suspended: number;
  users: number;
  banned: number;
  expiringSoon: number;
  plans: number;
  platformsEnabled: number;
  platforms: PlatformState[];
  proxies: number;
  proxiesOk: number;
  eventsToday: number;
}

export async function overview(): Promise<CloudOverview> {
  const [licenses, users, plans, platforms, proxies, events] = await Promise.all([
    listLicenses(),
    listUsers(),
    listPlans(),
    listPlatforms(),
    listProxies(500),
    listEvents(200),
  ]);
  const now = Date.now();
  const soon = now + 3 * 86400000;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  return {
    driver: driverLabel(),
    totalLicenses: licenses.length,
    pending: licenses.filter((license) => license.status === "pending").length,
    active: licenses.filter((license) => license.status === "active").length,
    expired: licenses.filter((license) => license.status === "expired").length,
    revoked: licenses.filter((license) => license.status === "revoked").length,
    suspended: licenses.filter((license) => license.status === "suspended").length,
    users: users.length,
    banned: users.filter((user) => user.banned).length,
    expiringSoon: licenses.filter(
      (license) => license.status === "active" && license.expiresAt && license.expiresAt <= soon
    ).length,
    plans: plans.length,
    platformsEnabled: platforms.filter((platform) => platform.enabled).length,
    platforms,
    proxies: proxies.length,
    proxiesOk: proxies.filter((proxy) => proxy.status === "ok").length,
    eventsToday: events.filter((event) => event.createdAt >= dayStart.getTime()).length,
  };
}

export { driver };
