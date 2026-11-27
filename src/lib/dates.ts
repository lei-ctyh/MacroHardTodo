import { format } from "date-fns";

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function dateToISO(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function nowHHmm(): string {
  return format(new Date(), "HH:mm");
}

export function isOverdue(dueDate?: string, dueTime?: string): boolean {
  if (!dueDate) return false;
  const today = todayISO();
  if (dueDate < today) return true;
  if (dueDate > today) return false;
  if (!dueTime) return false;
  return dueTime < nowHHmm();
}

function weekdayCN(d: Date): string {
  return "日一二三四五六"[d.getDay()];
}

/** 任务行紧凑日期标签（不含具体时间）：今天 / 明天 / 昨天 / 9月27日, 周日 / 2027年4月24日, 周六 */
export function dueDateLabel(dueDate?: string): string {
  if (!dueDate) return "";
  const today = todayISO();
  if (dueDate === today) return "今天";
  if (dueDate === dateToISO(new Date(Date.now() + 86400000))) return "明天";
  if (dueDate === dateToISO(new Date(Date.now() - 86400000))) return "昨天";
  const d = isoToDate(dueDate);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return sameYear
    ? `${d.getMonth() + 1}月${d.getDate()}日, 周${weekdayCN(d)}`
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日, 周${weekdayCN(d)}`;
}

/** 人类可读的日期标签，尽量贴近 MS To Do 的措辞 */
export function dueLabel(dueDate?: string, dueTime?: string): string {
  if (!dueDate) return "";
  const today = todayISO();
  const tomorrow = dateToISO(new Date(Date.now() + 86400000));
  const yesterday = dateToISO(new Date(Date.now() - 86400000));
  let base: string;
  if (dueDate === today) base = "今天";
  else if (dueDate === tomorrow) base = "明天";
  else if (dueDate === yesterday) base = "昨天";
  else {
    const d = isoToDate(dueDate);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    base = sameYear
      ? `${d.getMonth() + 1}月${d.getDate()}日 周${weekdayCN(d)}`
      : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }
  return dueTime ? `${base} ${dueTime}` : base;
}

/** 日期的口语标签：今天 / 明天 / 昨天 / 11月29日, 周日 */
export function dayLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return "今天";
  if (iso === dateToISO(new Date(Date.now() + 86400000))) return "明天";
  if (iso === dateToISO(new Date(Date.now() - 86400000))) return "昨天";
  const d = isoToDate(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日, 周${weekdayCN(d)}`;
}

export function reminderLabel(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const date = format(d, "yyyy-MM-dd");
  const today = todayISO();
  const day = date === today ? "今天" : dueLabel(date);
  return `${day} ${format(d, "HH:mm")}`;
}

export function combineDateTime(dueDate?: string, dueTime?: string): Date | null {
  if (!dueDate) return null;
  const [h, m] = (dueTime ?? "00:00").split(":").map(Number);
  const d = isoToDate(dueDate);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDaysISO(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + days);
  return dateToISO(d);
}

export function daysBetweenISO(a: string, b: string): number {
  return Math.round((isoToDate(b).getTime() - isoToDate(a).getTime()) / 86400000);
}

export function formatTimestamp(ts: number): string {
  return format(new Date(ts), "yyyy-MM-dd HH:mm");
}
