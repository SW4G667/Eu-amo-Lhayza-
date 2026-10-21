import crypto from "crypto";

const rawSecret =
  process.env.APP_SECRET ||
  process.env.APP_PASSWORD ||
  "atalaia-dev-secret-change-me";

const KEY = crypto.createHash("sha256").update(`atalaia:v1:${rawSecret}`).digest();

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  if (plain.startsWith("enc1.")) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc1.${iv.toString("base64url")}.${tag.toString("base64url")}.${data.toString("base64url")}`;
}

export function decryptSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.startsWith("enc1.")) return value;
  try {
    const [, ivB64, tagB64, dataB64] = value.split(".");
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const data = Buffer.from(dataB64, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("enc1.");
}

export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  return "••••••••";
}
