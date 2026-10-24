/** Tipos do domínio Atalaia Cloud (licenças, usuários, auditoria). */

export type LicenseStatus = "pending" | "active" | "expired" | "revoked" | "suspended";

export interface Plan {
  id: string;
  name: string;
  days: number;
  maxMonitors: number;
  maxChecksDay: number;
  priceCents: number;
  active: boolean;
  sort: number;
  createdAt: number;
}

export interface License {
  id: string;
  codeHash: string;
  /** Código cifrado (AES-256-GCM). Nunca é exibido sem ação explícita do admin. */
  codeEnc: string;
  codePrefix: string;
  planId: string | null;
  status: LicenseStatus;
  days: number;
  discordId: string | null;
  discordUsername: string | null;
  deviceHash: string | null;
  activations: number;
  maxActivations: number;
  activatedAt: number | null;
  expiresAt: number | null;
  revokedAt: number | null;
  revokedReason: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: number;
  lastSeenAt: number | null;
}

export interface CloudUser {
  id: string;
  discordId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  licenseId: string | null;
  role: "user" | "admin";
  banned: boolean;
  createdAt: number;
  lastLoginAt: number | null;
}

export type EventSeverity = "info" | "warn" | "danger" | "success";

export interface AuditEvent {
  id: string;
  kind: string;
  severity: EventSeverity;
  actor: string | null;
  licenseId: string | null;
  discordId: string | null;
  ip: string | null;
  userAgent: string | null;
  message: string;
  meta: Record<string, unknown>;
  createdAt: number;
}

export interface PlatformState {
  id: string;
  enabled: boolean;
  note: string;
  updatedAt: number | null;
  /** Metadados de apresentação (preenchidos a partir de `lib/platforms.ts`). */
  name: string;
  short: string;
  accent: string;
}

export interface CloudProxy {
  id: string;
  protocol: string;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  country: string | null;
  latencyMs: number | null;
  source: string;
  status: "unknown" | "ok" | "dead";
  lastCheckedAt: number | null;
  createdAt: number;
}

export interface Attempt {
  id: string;
  bucket: string;
  kind: string;
  ok: boolean;
  ip: string | null;
  createdAt: number;
}

export interface GateSettings {
  requireDiscord: boolean;
  requireGuild: boolean;
  guildId: string;
  maintenance: boolean;
  maintenanceMessage: string;
  welcome: string;
}

export interface BrandingSettings {
  productName: string;
  tagline: string;
}

export interface LimitSettings {
  maxActivations: number;
  defaultPlan: string;
  defaultDays: number;
}

export interface AlertSettingsCloud {
  discordWebhook: string;
  mention: string;
  enabled: boolean;
}

export interface DiscordSettings {
  clientId: string;
  guildId: string;
  requireGuild: boolean;
}

export interface SettingsMap {
  gate: GateSettings;
  branding: BrandingSettings;
  limits: LimitSettings;
  alerts: AlertSettingsCloud;
  discord: DiscordSettings;
}

export type SettingsKey = keyof SettingsMap;

export const DEFAULT_SETTINGS: SettingsMap = {
  gate: {
    requireDiscord: true,
    requireGuild: false,
    guildId: "",
    maintenance: false,
    maintenanceMessage: "Console em manutenção. Voltamos em instantes.",
    welcome: "Entre com o Discord ou ative sua key para usar o console.",
  },
  branding: { productName: "Atalaia", tagline: "username intel" },
  limits: { maxActivations: 2, defaultPlan: "pro", defaultDays: 30 },
  alerts: { discordWebhook: "", mention: "", enabled: false },
  discord: { clientId: "", guildId: "", requireGuild: false },
};
