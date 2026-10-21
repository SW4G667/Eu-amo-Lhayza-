import { decryptSecret, encryptSecret } from "./crypto";

/**
 * Persistência de estado no GitHub.
 *
 * O estado é serializado, cifrado com AES-256-GCM (chave derivada de
 * APP_SECRET) e gravado no branch `atalaia-state` do repositório. Assim o
 * painel na Vercel e o runner no GitHub Actions enxergam exatamente o mesmo
 * estado, sem precisar de Redis.
 *
 * Leitura: pública (raw.githubusercontent.com), ideal para deploys sem token.
 * Escrita: exige um token com permissão "Contents: Read and write".
 */

export interface GithubStateConfig {
  repo: string;
  branch: string;
  path: string;
  token: string;
  writable: boolean;
}

const DEFAULT_REPO = "SW4G667/Eu-amo-Lhayza-";
const DEFAULT_BRANCH = "atalaia-state";
const DEFAULT_PATH = ".atalaia/state.enc";
const API = "https://api.github.com";

function env(name: string): string {
  return (process.env[name] || "").trim();
}

/**
 * Token enviado pelo navegador (Ajustes → Conexão GitHub). Fica só no
 * localStorage do operador e viaja por header em cada requisição; nunca é
 * gravado no servidor.
 */
let runtimeToken = "";

export function setRuntimeStateToken(value: string | null | undefined): void {
  runtimeToken = (value ?? "").trim();
}

export function githubStateConfig(): GithubStateConfig | null {
  const mode = env("ATALAIA_STATE_MODE").toLowerCase();
  const token = env("ATALAIA_STATE_TOKEN") || runtimeToken;
  const enabled = mode === "github" || (!mode && Boolean(token));
  if (!enabled) return null;
  return {
    repo: env("ATALAIA_STATE_REPO") || DEFAULT_REPO,
    branch: env("ATALAIA_STATE_BRANCH") || DEFAULT_BRANCH,
    path: (env("ATALAIA_STATE_PATH") || DEFAULT_PATH).replace(/^\/+/, ""),
    token,
    writable: Boolean(token),
  };
}

function encodedPath(path: string): string {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function headers(cfg: GithubStateConfig, raw = false): Record<string, string> {
  const base: Record<string, string> = {
    Accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "atalaia-console",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
  if (cfg.token) base.Authorization = `Bearer ${cfg.token}`;
  return base;
}

async function timeoutFetch(url: string, init: RequestInit, ms = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/** Lê e decifra o estado. Retorna null quando o arquivo ainda não existe. */
export async function readGithubState(cfg: GithubStateConfig): Promise<unknown | null> {
  const url = cfg.token
    ? `${API}/repos/${cfg.repo}/contents/${encodedPath(cfg.path)}?ref=${encodeURIComponent(cfg.branch)}`
    : `https://raw.githubusercontent.com/${cfg.repo}/${cfg.branch}/${cfg.path}?v=${Date.now()}`;

  const res = await timeoutFetch(url, { headers: headers(cfg, true) });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub respondeu ${res.status} ao ler o estado`);
  }
  const payload = (await res.text()).trim();
  if (!payload) return null;
  const plain = payload.startsWith("enc1.") ? decryptSecret(payload) : payload;
  if (!plain) throw new Error("Não foi possível decifrar o estado (APP_SECRET diferente?)");
  return JSON.parse(plain) as unknown;
}

async function api(
  cfg: GithubStateConfig,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return timeoutFetch(`${API}${path}`, {
    ...init,
    headers: {
      ...headers(cfg),
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

/**
 * Grava o estado como um commit único (sem histórico acumulado): árvore nova,
 * commit sem pai e ref atualizada à força. Mantém o branch sempre com 1 commit.
 */
export async function writeGithubState(cfg: GithubStateConfig, data: unknown): Promise<void> {
  if (!cfg.token) {
    throw new Error(
      "Estado no GitHub em modo somente leitura. Defina ATALAIA_STATE_TOKEN para permitir edições."
    );
  }

  const content = encryptSecret(JSON.stringify(data));
  const response = await api(cfg, `/repos/${cfg.repo}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content, encoding: "utf-8" }),
  });
  if (!response.ok) {
    throw new Error(`GitHub recusou o blob (${response.status})`);
  }
  const blob = (await response.json()) as { sha: string };

  const treeResponse = await api(cfg, `/repos/${cfg.repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      tree: [{ path: cfg.path, mode: "100644", type: "blob", sha: blob.sha }],
    }),
  });
  if (!treeResponse.ok) {
    throw new Error(`GitHub recusou a árvore (${treeResponse.status})`);
  }
  const tree = (await treeResponse.json()) as { sha: string };

  const summary = summarize(data);
  const commitResponse = await api(cfg, `/repos/${cfg.repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: `atalaia: sync ${new Date().toISOString()} — ${summary}`,
      tree: tree.sha,
      parents: [],
    }),
  });
  if (!commitResponse.ok) {
    throw new Error(`GitHub recusou o commit (${commitResponse.status})`);
  }
  const commit = (await commitResponse.json()) as { sha: string };

  const refPath = `/repos/${cfg.repo}/git/refs/heads/${encodeURIComponent(cfg.branch)}`;
  const patch = await api(cfg, refPath, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: true }),
  });
  if (patch.ok) return;

  if (patch.status === 404 || patch.status === 422) {
    const created = await api(cfg, `/repos/${cfg.repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${cfg.branch}`, sha: commit.sha }),
    });
    if (created.ok) return;
    throw new Error(`GitHub recusou criar o branch ${cfg.branch} (${created.status})`);
  }
  throw new Error(`GitHub recusou atualizar o branch ${cfg.branch} (${patch.status})`);
}

function summarize(data: unknown): string {
  const store = data as { stats?: { checks?: number; available?: number }; jobs?: unknown[] };
  const checks = store?.stats?.checks ?? 0;
  const available = store?.stats?.available ?? 0;
  const monitors = Array.isArray(store?.jobs) ? store.jobs.length : 0;
  return `${checks} checagens, ${available} livres, ${monitors} monitores`;
}
