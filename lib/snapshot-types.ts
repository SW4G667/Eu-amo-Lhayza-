import type { PlatformState } from "./cloud/types";
import type { PublicLicense } from "./cloud/serialize";
import type {
  AlertSettings,
  EngineSettings,
  Hit,
  Job,
  LogEntry,
  ProxyRecord,
  Stats,
} from "./types";

export interface SafeProxy
  extends Omit<ProxyRecord, "password" | "cooldownUntil"> {
  hasPassword: boolean;
}

export interface CredentialInfo {
  configured: boolean;
  valid: boolean | null;
  username: string | null;
  detail: string;
  checkedAt: number | null;
}

export interface Snapshot {
  jobs: Job[];
  hits: Hit[];
  logs: LogEntry[];
  proxies: SafeProxy[];
  stats: Stats;
  settings: {
    alerts: AlertSettings;
    engine: EngineSettings;
  };
  credentials: {
    discord: CredentialInfo;
    github: CredentialInfo;
    twitch: CredentialInfo;
    telegramBot: CredentialInfo;
  };
  engine: {
    mode: "persistent" | "serverless";
    startedAt: number;
    lastTickAt: number | null;
    busy: boolean;
    scheduledJobs: number;
    cooldowns: Record<string, number>;
  };
  platforms: PlatformState[];
  me: {
    kind: "admin" | "user";
    label: string;
    license: PublicLicense | null;
  } | null;
  runtime: {
    storage: string;
    vercel: boolean;
    defaultPassword: boolean;
    version: string;
    uptimeMs: number;
    state: {
      driver: "file" | "redis" | "github" | "memory";
      label: string;
      writable: boolean;
      repo: string | null;
      branch: string | null;
      syncedAt: number | null;
      error: string | null;
      runner: { lastSeenAt: number; host: string; version: string } | null;
    };
  };
  now: number;
}

export interface ApiError {
  error: string;
}
