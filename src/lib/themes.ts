import { api } from "./api";
import type { DB, ListTheme, SmartViewId } from "./model";

export const MYDAY_THEME_KEY = "mydayTheme";

export interface ThemePreset {
  id: string;
  name: string;
  ext?: "jpg" | "webp";
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "dawn", name: "破晓" },
  { id: "sea", name: "海面" },
  { id: "forest", name: "森林" },
  { id: "night", name: "星夜" },
  { id: "desert", name: "沙丘" },
  { id: "aurora", name: "极光", ext: "webp" },
  { id: "city", name: "城市" },
  { id: "bloom", name: "花园" },
  { id: "alpine", name: "雪山" },
  { id: "autumn", name: "秋林" },
  { id: "lake", name: "湖光" },
  { id: "sakura", name: "樱暮" },
  { id: "canyon", name: "峡谷", ext: "webp" },
  { id: "nebula", name: "星云" },
];

const PRESET_EXT = new Map(THEME_PRESETS.map((p) => [p.id, p.ext ?? "jpg"]));

export function presetUrl(id: string): string {
  return `/backgrounds/${id}.${PRESET_EXT.get(id) ?? "jpg"}`;
}

/** 智能视图主题在 db.shared 中的键：我的一天沿用旧键，其余为 `theme:<id>` */
export function smartThemeKey(id: SmartViewId): string {
  return id === "myday" ? MYDAY_THEME_KEY : `theme:${id}`;
}

export function smartTheme(db: DB, id: SmartViewId): ListTheme | undefined {
  const value = db.shared[smartThemeKey(id)]?.value;
  return (value ?? undefined) as ListTheme | undefined;
}

export function myDayTheme(db: DB): ListTheme | undefined {
  return smartTheme(db, "myday");
}

function darkenHex(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.round(((value >> 16) & 255) * (1 - amount));
  const g = Math.round(((value >> 8) & 255) * (1 - amount));
  const b = Math.round((value & 255) * (1 - amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function lightenHex(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.round(((value >> 16) & 255) + (255 - ((value >> 16) & 255)) * amount);
  const g = Math.round(((value >> 8) & 255) + (255 - ((value >> 8) & 255)) * amount);
  const b = Math.round((value & 255) + (255 - (value & 255)) * amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function hexLuminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * 主题强调色（星标、已完成勾选圆点、添加步骤等）：
 * 浅色模式取颜色主题最深色标 / 图片主题中性灰 `#687681`；
 * 深色模式自动提亮低亮度色标，图片主题对应提亮为中性浅灰蓝 `#94a1ac`（不回退成默认亮蓝）。
 */
export function themeAccent(
  theme: ListTheme | undefined,
): { base: string; hover: string; darkBase: string; darkHover: string } | undefined {
  if (!theme) return undefined;
  let base: string | undefined;
  let darkBase: string | undefined;
  if (theme.color) {
    const stops = theme.color.match(/#[0-9a-fA-F]{6}/g);
    base = stops?.length ? stops[stops.length - 1] : undefined;
    if (base) {
      darkBase = hexLuminance(base) < 0.52 ? lightenHex(base, 0.36) : base;
    }
  } else if (theme.preset || theme.image) {
    base = "#687681";
    darkBase = "#94a1ac";
  }
  if (!base || !darkBase) return undefined;
  return {
    base,
    hover: darkenHex(base, 0.14),
    darkBase,
    darkHover: lightenHex(darkBase, 0.12),
  };
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
    case "alpine":
      return "linear-gradient(135deg,#0f2544,#2c537a 55%,#7aa6c2)";
    case "autumn":
      return "linear-gradient(135deg,#3b1628,#8c2f39 50%,#d96b38)";
    case "lake":
      return "linear-gradient(135deg,#0b1d33,#1e496b 55%,#4e8fa6)";
    case "sakura":
      return "linear-gradient(135deg,#2b1e4a,#6b3e75 50%,#cf7ca0)";
    case "canyon":
      return "linear-gradient(135deg,#2c1638,#7c3052 50%,#d4654e)";
    case "nebula":
      return "linear-gradient(135deg,#040714,#1e1b4b 55%,#4c1d95)";
    default:
      return "linear-gradient(135deg,#274b86,#6b3f78)";
  }
}
