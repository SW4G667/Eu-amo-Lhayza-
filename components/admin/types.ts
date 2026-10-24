import type { CloudOverview } from "@/lib/cloud/repo";
import type { AdminLicense } from "@/lib/cloud/serialize";
import type {
  AuditEvent,
  CloudProxy,
  CloudUser,
  Plan,
  PlatformState,
  SettingsMap,
} from "@/lib/cloud/types";

export interface PhanomInfo {
  configured: boolean;
  ok: boolean;
  message: string;
  version?: string | null;
  bots?: Array<{ id: string; name?: string; status?: string; plan?: string }> | null;
  base?: string;
}

export interface OverviewPayload {
  summary: CloudOverview;
  settings: SettingsMap;
  plans: Plan[];
  events: AuditEvent[];
  discordConfigured: boolean;
  phanom: PhanomInfo;
  adminKeyDefault: boolean;
  driver: string;
  version: string;
  now: number;
}

export interface LicensesPayload {
  licenses: AdminLicense[];
  counters: Record<"total" | "pending" | "active" | "expired" | "revoked" | "suspended", number>;
}

export interface UsersPayload {
  users: Array<CloudUser & { avatarUrl: string | null; license: AdminLicense | null }>;
}

export interface AdminData {
  overview: OverviewPayload;
  licenses: LicensesPayload;
  users: UsersPayload;
  platforms: PlatformState[];
  proxies: CloudProxy[];
  events: AuditEvent[];
  settings: SettingsMap;
}

export type AdminTab =
  | "visao"
  | "licencas"
  | "planos"
  | "usuarios"
  | "plataformas"
  | "proxies"
  | "eventos"
  | "ajustes";
