import type { License } from "./types";

/** Versão pública de uma licença: sem hash, sem código cifrado. */
export interface PublicLicense {
  id: string;
  prefix: string;
  planId: string | null;
  status: License["status"];
  days: number;
  activatedAt: number | null;
  expiresAt: number | null;
  activations: number;
  maxActivations: number;
  remainingDays: number | null;
  discordUsername: string | null;
  note: string | null;
}

export function publicLicense(license: License | null): PublicLicense | null {
  if (!license) return null;
  const remainingDays =
    license.expiresAt && license.status === "active"
      ? Math.max(0, Math.ceil((license.expiresAt - Date.now()) / 86400000))
      : null;
  return {
    id: license.id,
    prefix: license.codePrefix,
    planId: license.planId,
    status: license.status,
    days: license.days,
    activatedAt: license.activatedAt,
    expiresAt: license.expiresAt,
    activations: license.activations,
    maxActivations: license.maxActivations,
    remainingDays,
    discordUsername: license.discordUsername,
    note: license.note,
  };
}

export interface AdminLicense extends Omit<License, "codeHash" | "codeEnc"> {}

/** Versão para o painel: mantém o prefixo, remove hash e código cifrado. */
export function adminLicense(license: License): AdminLicense {
  const { codeHash: _hash, codeEnc: _enc, ...rest } = license;
  return rest;
}
