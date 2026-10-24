import crypto from "crypto";
import { decryptSecret, encryptSecret } from "../crypto";

/**
 * Geração e verificação de keys de licença.
 *
 * - alfabeto sem caracteres ambíguos (0/O, 1/I/L)
 * - o código em texto só existe no momento da geração e no "revelar" do admin
 * - no banco ficam apenas o hash SHA-256 e uma cópia cifrada em AES-256-GCM
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GROUPS = 3;
const GROUP_SIZE = 5;

function randomChunk(size: number): string {
  const bytes = crypto.randomBytes(size);
  let out = "";
  for (let index = 0; index < size; index += 1) {
    out += ALPHABET[bytes[index] % ALPHABET.length];
  }
  return out;
}

export function generateCode(prefix = "ATL"): string {
  const groups = Array.from({ length: GROUPS }, () => randomChunk(GROUP_SIZE));
  return `${prefix}-${groups.join("-")}`;
}

/** Remove separadores e normaliza para hash/comparação. */
export function normalizeCode(input: string): string {
  return (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashCode(code: string): string {
  return crypto.createHash("sha256").update(normalizeCode(code)).digest("hex");
}

export function encryptCode(code: string): string {
  return encryptSecret(normalizeCode(code));
}

export function decryptCode(value: string): string {
  const compact = decryptSecret(value);
  if (!compact) return "";
  return formatCode(compact);
}

/** ATL-XXXXX-XXXXX-XXXXX a partir do formato compacto. */
export function formatCode(compact: string): string {
  const clean = normalizeCode(compact);
  if (clean.length <= 3) return clean;
  const prefix = clean.slice(0, 3);
  const rest = clean.slice(3);
  const groups = rest.match(/.{1,5}/g) ?? [];
  return [prefix, ...groups].join("-");
}

export function codePrefix(code: string): string {
  const compact = normalizeCode(code);
  return `••••-${compact.slice(-4)}`;
}

export function looksLikeCode(input: string): boolean {
  const compact = normalizeCode(input);
  return compact.length >= 12 && compact.length <= 32;
}

export function safeEqual(a: string, b: string): boolean {
  const first = Buffer.from(String(a));
  const second = Buffer.from(String(b));
  if (first.length !== second.length) return false;
  return crypto.timingSafeEqual(first, second);
}
