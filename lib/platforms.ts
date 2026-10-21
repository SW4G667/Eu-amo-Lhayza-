import type { PlatformId } from "./types";

export interface PlatformMeta {
  id: PlatformId;
  name: string;
  short: string;
  accent: string;
  minLength: number;
  maxLength: number;
  charset: string;
  requires: "none" | "discord" | "github" | "twitch";
  claimUrl: (name: string) => string;
  profileUrl: (name: string) => string;
  note: string;
}

const lower = "abcdefghijklmnopqrstuvwxyz";

export const PLATFORMS: Record<PlatformId, PlatformMeta> = {
  discord: {
    id: "discord",
    name: "Discord",
    short: "DSC",
    accent: "#8B9CFF",
    minLength: 2,
    maxLength: 32,
    charset: `${lower}0123456789._`,
    requires: "discord",
    claimUrl: () => "https://discord.com/channels/@me",
    profileUrl: () => "https://discord.com/users/@me",
    note: "Checagem autenticada pelo endpoint oficial de username. Exige o token de uma conta sua.",
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    short: "TTK",
    accent: "#5FE1D0",
    minLength: 2,
    maxLength: 24,
    charset: `${lower}0123456789._`,
    requires: "none",
    claimUrl: () => "https://www.tiktok.com/signup",
    profileUrl: (name) => `https://www.tiktok.com/@${name}`,
    note: "Lê a página pública do perfil. Não precisa de login.",
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    short: "IG",
    accent: "#F2A0B5",
    minLength: 1,
    maxLength: 30,
    charset: `${lower}0123456789._`,
    requires: "none",
    claimUrl: () => "https://www.instagram.com/accounts/emailsignup/",
    profileUrl: (name) => `https://www.instagram.com/${name}/`,
    note: "Usa o endpoint web de perfil. Pode pedir pausa em rajadas longas.",
  },
  github: {
    id: "github",
    name: "GitHub",
    short: "GH",
    accent: "#B4BDB0",
    minLength: 1,
    maxLength: 39,
    charset: `${lower}0123456789-`,
    requires: "none",
    claimUrl: () => "https://github.com/signup",
    profileUrl: (name) => `https://github.com/${name}`,
    note: "API pública e estável. Limite de 60 checagens/hora por IP — use um token para 5.000.",
  },
  telegram: {
    id: "telegram",
    name: "Telegram",
    short: "TG",
    accent: "#7EC8F7",
    minLength: 5,
    maxLength: 32,
    charset: `${lower}0123456789_`,
    requires: "none",
    claimUrl: () => "https://telegram.org/",
    profileUrl: (name) => `https://t.me/${name}`,
    note: "Verifica a página pública t.me. Usernames do Telegram começam em 5 caracteres.",
  },
  twitch: {
    id: "twitch",
    name: "Twitch",
    short: "TW",
    accent: "#C4A5FF",
    minLength: 4,
    maxLength: 25,
    charset: `${lower}0123456789_`,
    requires: "twitch",
    claimUrl: () => "https://www.twitch.tv/signup",
    profileUrl: (name) => `https://www.twitch.tv/${name}`,
    note: "Consulta a API Helix oficial. Configure client ID e secret do seu app na Twitch.",
  },
  steam: {
    id: "steam",
    name: "Steam",
    short: "STM",
    accent: "#9FB6CC",
    minLength: 3,
    maxLength: 32,
    charset: `${lower}0123456789_`,
    requires: "none",
    claimUrl: () => "https://store.steampowered.com/join/",
    profileUrl: (name) => `https://steamcommunity.com/id/${name}`,
    note: "Lê o XML público do perfil de vaidade.",
  },
  roblox: {
    id: "roblox",
    name: "Roblox",
    short: "RBX",
    accent: "#EE8C8C",
    minLength: 3,
    maxLength: 20,
    charset: `${lower}0123456789_`,
    requires: "none",
    claimUrl: () => "https://www.roblox.com/signup",
    profileUrl: (name) => `https://www.roblox.com/search/users?keyword=${name}`,
    note: "API pública de usuários. Boa taxa de resposta e sem token.",
  },
  youtube: {
    id: "youtube",
    name: "YouTube",
    short: "YT",
    accent: "#FF8A80",
    minLength: 3,
    maxLength: 30,
    charset: `${lower}0123456789._-`,
    requires: "none",
    claimUrl: () => "https://www.youtube.com/handle",
    profileUrl: (name) => `https://www.youtube.com/@${name}`,
    note: "Confere se o handle @ existe. Handles são case-insensitive.",
  },
  reddit: {
    id: "reddit",
    name: "Reddit",
    short: "RDT",
    accent: "#FF9A62",
    minLength: 3,
    maxLength: 20,
    charset: `${lower}0123456789_`,
    requires: "none",
    claimUrl: () => "https://www.reddit.com/register/",
    profileUrl: (name) => `https://www.reddit.com/user/${name}`,
    note: "API pública .json. Alguns IPs de datacenter são bloqueados — proxy ajuda aqui.",
  },
  pinterest: {
    id: "pinterest",
    name: "Pinterest",
    short: "PIN",
    accent: "#F27C7C",
    minLength: 3,
    maxLength: 30,
    charset: `${lower}0123456789_`,
    requires: "none",
    claimUrl: () => "https://www.pinterest.com/business/create/",
    profileUrl: (name) => `https://www.pinterest.com/${name}/`,
    note: "Checa a página pública do perfil.",
  },
};

export const PLATFORM_LIST = Object.values(PLATFORMS);

export function platformMeta(id: PlatformId): PlatformMeta {
  return PLATFORMS[id] ?? PLATFORMS.discord;
}

export function isPlatformId(v: string): v is PlatformId {
  return Object.prototype.hasOwnProperty.call(PLATFORMS, v);
}
