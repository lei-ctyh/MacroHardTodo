import { api } from "./api";
import type { DB, ListTheme } from "./model";

export const MYDAY_THEME_KEY = "mydayTheme";

export interface ThemePreset {
  id: string;
  name: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "dawn", name: "破晓" },
  { id: "sea", name: "海面" },
  { id: "forest", name: "森林" },
  { id: "night", name: "星夜" },
  { id: "desert", name: "沙丘" },
  { id: "aurora", name: "极光" },
  { id: "city", name: "城市" },
  { id: "bloom", name: "花园" },
];

export const THEME_EMOJIS = [
  "📋", "📌", "⭐", "🔥", "💡", "✅", "🎯", "📚",
  "💼", "🏠", "🛒", "✈️", "🏃", "🎵", "🎨", "🍀",
  "❤️", "🌙", "☀️", "🐱", "🎮", "🧪", "💰", "🎁",
  "🍎", "☕", "🌱", "🧘", "📝", "🚀", "🏆", "🧹",
];

export function presetUrl(id: string): string {
  return `/backgrounds/${id}.svg`;
}

export function myDayTheme(db: DB): ListTheme | undefined {
  const value = db.shared[MYDAY_THEME_KEY]?.value;
  return (value ?? undefined) as ListTheme | undefined;
}

const imageCache = new Map<string, string>();

/** 解析主题背景：预设返回静态资源地址，自定义图片转成 data URL（并支持跨设备按需下载） */
export async function resolveThemeBackground(
  theme: ListTheme | undefined,
  ensure: (relPath: string) => Promise<boolean>,
): Promise<string | undefined> {
  if (!theme) return undefined;
  if (theme.preset) return presetUrl(theme.preset);
  if (theme.image) {
    const key = theme.image.relPath;
    const hit = imageCache.get(key);
    if (hit) return hit;
    const ok = await ensure(key);
    if (!ok) return undefined;
    try {
      const base64 = await api.attachmentRead(key);
      const url = `data:${theme.image.mime || "image/png"};base64,${base64}`;
      imageCache.set(key, url);
      return url;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** 主题对应的兜底渐变色（图片加载失败或纯 emoji 时使用） */
export function themeFallback(theme: ListTheme | undefined): string {
  switch (theme?.preset) {
    case "dawn":
      return "linear-gradient(135deg,#1b2a5b,#8b4a86 50%,#f08a6b)";
    case "sea":
      return "linear-gradient(135deg,#075985,#0ea5e9 60%,#67e8f9)";
    case "forest":
      return "linear-gradient(135deg,#052e16,#166534 60%,#4ade80)";
    case "night":
      return "linear-gradient(135deg,#020617,#1e293b 60%,#334155)";
    case "desert":
      return "linear-gradient(135deg,#7c2d12,#d97706 60%,#fde68a)";
    case "aurora":
      return "linear-gradient(135deg,#0f172a,#4c1d95 50%,#059669)";
    case "city":
      return "linear-gradient(135deg,#1e1b4b,#4338ca 60%,#f472b6)";
    case "bloom":
      return "linear-gradient(135deg,#831843,#db2777 55%,#fbcfe8)";
    default:
      return "linear-gradient(135deg,#274b86,#6b3f78)";
  }
}
