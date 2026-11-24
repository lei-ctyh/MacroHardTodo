import {
  activeLists,
  createStep,
  createTask,
  nowMs,
  uid,
  type DB,
  type Step,
  type Task,
  type TaskList,
} from "./model";

/* ---------- 微软 Graph 原始数据结构（只声明用到的字段） ---------- */

export interface GraphDateTime {
  dateTime?: string;
  timeZone?: string;
}

export interface GraphChecklistItem {
  id?: string;
  displayName?: string;
  isChecked?: boolean;
  checkedDateTime?: string | null;
}

export interface GraphRecurrence {
  pattern?: {
    type?: string;
    interval?: number;
    daysOfWeek?: string[];
    dayOfMonth?: number;
    index?: string;
  };
  range?: {
    type?: string;
    endDate?: string;
    numberOfOccurrences?: number;
  };
}

export interface GraphTaskRaw {
  id: string;
  title?: string;
  body?: { content?: string; contentType?: string };
  importance?: string;
  status?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  completedDateTime?: GraphDateTime;
  dueDateTime?: GraphDateTime;
  reminderDateTime?: GraphDateTime;
  checklistItems?: GraphChecklistItem[];
  recurrence?: GraphRecurrence;
  seriesMasterId?: string;
  [key: string]: unknown;
}

export interface GraphListRaw {
  id: string;
  displayName?: string;
  wellknownListName?: string;
  [key: string]: unknown;
}

/* ---------- 转换 ---------- */

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function htmlToText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Graph 的 dateTime 形如 2026-11-24T09:00:00.0000000（无时区偏移） */
function parseGraphDateTime(value?: GraphDateTime): number | undefined {
  const raw = value?.dateTime;
  if (!raw) return undefined;
  const normalized = raw.replace(/(\.\d{3})\d+/, "$1").replace(/Z$/, "");
  const ts = new Date(normalized).getTime();
  return Number.isNaN(ts) ? undefined : ts;
}

function graphDateParts(value?: GraphDateTime): { date?: string; time?: string } {
  const raw = value?.dateTime;
  if (!raw || raw.length < 10) return {};
  const date = raw.slice(0, 10);
  const time = raw.slice(11, 16);
  return { date, time: time === "00:00" ? undefined : time };
}

function mapRecurrence(raw: GraphRecurrence | undefined) {
  const type = raw?.pattern?.type;
  if (!type) return undefined;
  const freq =
    type === "daily"
      ? ("daily" as const)
      : type === "weekly"
        ? ("weekly" as const)
        : type === "absoluteMonthly" || type === "relativeMonthly"
          ? ("monthly" as const)
          : type === "absoluteYearly" || type === "relativeYearly"
            ? ("yearly" as const)
            : null;
  if (!freq) return undefined;
  const byWeekday = raw.pattern?.daysOfWeek
    ?.map((d) => WEEKDAY_MAP[d.toLowerCase()])
    .filter((n): n is number => typeof n === "number" && n >= 0);
  return {
    freq,
    interval: Math.max(1, raw.pattern?.interval ?? 1),
    byWeekday: freq === "weekly" && byWeekday?.length ? byWeekday : undefined,
    endDate: raw.range?.endDate ? raw.range.endDate.slice(0, 10) : undefined,
    totalOccurrences: raw.range?.numberOfOccurrences ?? undefined,
    occurrenceIndex: 1,
  };
}

export function mapGraphTask(
  raw: GraphTaskRaw,
  listId: string,
  deviceId: string,
  order: number,
): Task {
  const due = graphDateParts(raw.dueDateTime);
  const body = raw.body?.content ?? "";
  const notes =
    raw.body?.contentType === "html" || /<[a-z][\s\S]*>/i.test(body)
      ? htmlToText(body)
      : body.trim();

  const steps: Step[] = (raw.checklistItems ?? []).map((item, index) => ({
    id: uid("step"),
    title: item.displayName ?? "",
    completed: Boolean(item.isChecked),
    order: index,
    updatedAt: nowMs(),
    updatedBy: deviceId,
  }));

  const created = parseGraphDateTime({
    dateTime: raw.createdDateTime,
  });
  const updated = parseGraphDateTime({
    dateTime: raw.lastModifiedDateTime,
  });

  return {
    id: uid("task"),
    listId,
    title: (raw.title ?? "").trim() || "未命名任务",
    notes: notes || undefined,
    completed: raw.status === "completed",
    completedAt: parseGraphDateTime(raw.completedDateTime),
    createdAt: created ?? nowMs(),
    updatedAt: updated ?? nowMs(),
    updatedBy: deviceId,
    dueDate: due.date,
    dueTime: due.time,
    reminderAt: parseGraphDateTime(raw.reminderDateTime),
    importance: raw.importance === "high" ? "high" : "normal",
    myDay: null,
    steps,
    recurrence: mapRecurrence(raw.recurrence),
    seriesId: raw.seriesMasterId,
    order,
    sourceId: raw.id,
  };
}

export function mapGraphList(
  raw: GraphListRaw,
  deviceId: string,
  order: number,
): TaskList {
  const now = nowMs();
  return {
    id: uid("list"),
    name: (raw.displayName ?? "").trim() || "未命名列表",
    order,
    createdAt: now,
    updatedAt: now,
    updatedBy: deviceId,
    sourceId: raw.id,
  };
}

export interface ImportStats {
  createdLists: number;
  createdTasks: number;
  skippedTasks: number;
}

/**
 * 幂等导入：列表按 sourceId 或名称复用；任务按 sourceId 去重。
 * 已存在的任务不会被覆盖，避免冲掉本地修改。
 */
export function applyGraphImport(
  db: DB,
  deviceId: string,
  graphLists: GraphListRaw[],
  graphTasksByListId: Record<string, GraphTaskRaw[]>,
): { db: DB; stats: ImportStats } {
  let createdLists = 0;
  let createdTasks = 0;
  let skippedTasks = 0;

  const lists = [...db.lists];
  const listIdMap = new Map<string, string>();
  const existing = activeLists(db);
  let order = existing.length;

  for (const gList of graphLists) {
    const match =
      lists.find((l) => !l.deletedAt && l.sourceId === gList.id) ??
      lists.find(
        (l) => !l.deletedAt && l.name === (gList.displayName ?? "").trim(),
      );
    if (match) {
      listIdMap.set(gList.id, match.id);
      continue;
    }
    const mapped = mapGraphList(gList, deviceId, order++);
    lists.push(mapped);
    listIdMap.set(gList.id, mapped.id);
    createdLists++;
  }

  const tasks = [...db.tasks];
  const knownSource = new Set(
    tasks.filter((t) => t.sourceId).map((t) => t.sourceId as string),
  );
  const maxOrder = new Map<string, number>();
  for (const t of tasks) {
    if (t.deletedAt) continue;
    maxOrder.set(t.listId, Math.max(maxOrder.get(t.listId) ?? 0, t.order));
  }

  for (const [graphListId, items] of Object.entries(graphTasksByListId)) {
    const localListId = listIdMap.get(graphListId);
    if (!localListId) continue;
    for (const raw of items) {
      if (knownSource.has(raw.id)) {
        skippedTasks++;
        continue;
      }
      const nextOrder = (maxOrder.get(localListId) ?? 0) + 1;
      maxOrder.set(localListId, nextOrder);
      tasks.push(mapGraphTask(raw, localListId, deviceId, nextOrder));
      knownSource.add(raw.id);
      createdTasks++;
    }
  }

  return {
    db: { ...db, lists, tasks },
    stats: { createdLists, createdTasks, skippedTasks },
  };
}
