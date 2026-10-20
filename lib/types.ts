export type PlatformId =
  | "discord"
  | "tiktok"
  | "instagram"
  | "github"
  | "telegram"
  | "twitch"
  | "steam"
  | "roblox"
  | "youtube"
  | "reddit"
  | "pinterest";

export type CheckStatus =
  | "available"
  | "taken"
  | "error"
  | "rate_limited"
  | "unconfigured"
  | "unsupported";

export type JobMode = "sequential" | "random" | "pattern" | "wordlist";

export interface Job {
  id: string;
  name: string;
  platform: PlatformId;
  enabled: boolean;
  mode: JobMode;
  lengths: number[];
  charset: string;
  pattern: string;
  words: string[];
  batchSize: number;
  intervalMs: number;
  concurrency: number;
  useProxies: boolean;
  minScore: number;
  cursor: string | null;
  checked: number;
  found: number;
  createdAt: number;
  lastRunAt: number | null;
  lastError: string | null;
}

export interface Hit {
  id: string;
  jobId: string;
  jobName: string;
  platform: PlatformId;
  username: string;
  foundAt: number;
  latencyMs: number;
  score: number;
  notified: boolean;
}

export interface LogEntry {
  id: string;
  ts: number;
  level: "info" | "available" | "taken" | "error";
  platform: PlatformId | null;
  username: string | null;
  message: string;
  latencyMs: number | null;
  proxy: string | null;
}

export interface ProxyRecord {
  id: string;
  host: string;
  port: number;
  protocol: "http" | "https" | "socks5";
  username: string | null;
  password: string | null;
  enabled: boolean;
  ok: boolean | null;
  latencyMs: number | null;
  lastChecked: number | null;
  failures: number;
  cooldownUntil: number;
}

export interface Bucket {
  t: number;
  checks: number;
  available: number;
  errors: number;
}

export interface Stats {
  checks: number;
  available: number;
  errors: number;
  rateLimited: number;
  byPlatform: Record<string, { checks: number; available: number }>;
  buckets: Bucket[];
  startedAt: number;
}

export interface AlertSettings {
  discordWebhook: string;
  discordEnabled: boolean;
  mention: string;
  telegramEnabled: boolean;
  telegramChatId: string;
}

export interface EngineSettings {
  paused: boolean;
  jitterPct: number;
  timeoutMs: number;
  maxConcurrency: number;
  userAgent: string;
}

export interface DiscordCredential {
  token: string;
  username: string | null;
  userId: string | null;
  valid: boolean | null;
  checkedAt: number | null;
}

export interface GithubCredential {
  token: string;
  login: string | null;
  valid: boolean | null;
  checkedAt: number | null;
}

export interface TwitchCredential {
  clientId: string;
  clientSecret: string;
  valid: boolean | null;
  checkedAt: number | null;
}

export interface TelegramBotCredential {
  token: string;
  username: string | null;
  valid: boolean | null;
  checkedAt: number | null;
}

export interface Credentials {
  discord?: DiscordCredential;
  github?: GithubCredential;
  twitch?: TwitchCredential;
  telegramBot?: TelegramBotCredential;
}

export interface DataShape {
  version: number;
  settings: {
    alerts: AlertSettings;
    engine: EngineSettings;
  };
  jobs: Job[];
  hits: Hit[];
  proxies: ProxyRecord[];
  logs: LogEntry[];
  stats: Stats;
  credentials: Credentials;
}

export const DEFAULT_CHARSET = "abcdefghijklmnopqrstuvwxyz";
