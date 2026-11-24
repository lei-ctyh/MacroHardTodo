export type ID = string;

/** 列表排序方式：我的顺序 / 重要 / 截止日期 / 已添加 / 字母顺序 */
export type SortKey = "manual" | "importance" | "due" | "added" | "alpha";

export const SMART_VIEWS = ["myday", "important", "planned", "tasks", "completed"] as const;
export type SmartViewId = (typeof SMART_VIEWS)[number];

export interface Attachment {
  id: string;
  name: string;
  size: number;
  mime: string;
  relPath: string;
  updatedAt: number;
  updatedBy?: string;
  deletedAt?: number;
}

export interface Step {
  id: string;
  title: string;
  completed: boolean;
  order: number;
  updatedAt: number;
  updatedBy?: string;
  deletedAt?: number;
}

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  interval: number;
  /** 0 = 周日 … 6 = 周六 */
  byWeekday?: number[];
  /** YYYY-MM-DD，最后一天 */
  endDate?: string;
  /** 总发生次数（含首次） */
  totalOccurrences?: number;
  /** 当前实例序号，从 1 开始 */
  occurrenceIndex?: number;
}

export interface Task {
  id: string;
  listId: string;
  title: string;
  notes?: string;
  completed: boolean;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
  updatedBy?: string;
  deletedAt?: number;
  dueDate?: string;
  dueTime?: string;
  reminderAt?: number;
  importance: "normal" | "high";
  myDay?: string | null;
  steps: Step[];
  recurrence?: RecurrenceRule;
  tags?: string[];
  attachments?: Attachment[];
  seriesId?: string;
  occurrenceKey?: string;
  order: number;
  sourceId?: string;
}

export interface ThemeImage {
  relPath: string;
  mime: string;
  name: string;
  size: number;
}

/** 列表 / 我的一天的主题：预设背景、自定义图片、emoji */
export interface ListTheme {
  preset?: string;
  image?: ThemeImage;
  emoji?: string;
}

export interface TaskList {
  id: string;
  name: string;
  color?: string;
  theme?: ListTheme;
  order: number;
  /** 所属分组；undefined 表示未分组 */
  groupId?: string;
  createdAt: number;
  updatedAt: number;
  updatedBy?: string;
  deletedAt?: number;
  sourceId?: string;
}

/** 侧栏列表分组：只负责组织列表，删除分组不影响其列表和任务 */
export interface TaskGroup {
  id: string;
  name: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  updatedBy?: string;
  deletedAt?: number;
  sourceId?: string;
}

export interface SharedValue {
  value: unknown;
  updatedAt: number;
  updatedBy: string;
}

export interface Settings {
  theme: "light" | "dark" | "system";
  autoPurgeCompletedDays: number;
  reminderEnabled: boolean;
  startMinimized: boolean;
  globalShortcutEnabled: boolean;
  lastSyncAt?: number;
  webdavUrl?: string;
  webdavUser?: string;
  webdavEncrypt?: boolean;
  graphClientId?: string;
  /** 每个视图各自的排序选择，key 为 `list:<id>` 或 `smart:<id>`；仅本地保存 */
  sortBy?: Record<string, SortKey>;
  /** 已折叠的分组 id；仅本地保存 */
  collapsedGroups: string[];
  /** 侧栏宽度（px）；仅本地保存 */
  sidebarWidth?: number;
}

export interface DB {
  schemaVersion: 1;
  deviceId: string;
  lists: TaskList[];
  groups: TaskGroup[];
  tasks: Task[];
  shared: Record<string, SharedValue>;
  settings: Settings;
}

export const LIST_COLORS = [
  "#2564cf",
  "#0078d4",
  "#498205",
  "#8764b8",
  "#c239b3",
  "#e3008c",
  "#d13438",
  "#ca5010",
  "#8e562e",
  "#69797e",
];

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  autoPurgeCompletedDays: 0,
  reminderEnabled: true,
  startMinimized: false,
  globalShortcutEnabled: true,
  webdavEncrypt: false,
  sortBy: {},
  collapsedGroups: [],
  sidebarWidth: 240,
};

export function nowMs(): number {
  return Date.now();
}

export function uid(prefix = ""): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}_${id}` : id;
}

export function newDeviceId(): string {
  return uid("dev");
}

export function createDB(deviceId: string): DB {
  const now = nowMs();
  const tasksList: TaskList = {
    id: uid("list"),
    name: "任务",
    order: 0,
    createdAt: now,
    updatedAt: now,
    updatedBy: deviceId,
  };
  return {
    schemaVersion: 1,
    deviceId,
    lists: [tasksList],
    groups: [],
    tasks: [],
    shared: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function createTask(
  deviceId: string,
  input: Partial<Task> & { listId: string; title: string },
): Task {
  const now = nowMs();
  return {
    id: uid("task"),
    listId: input.listId,
    title: input.title,
    notes: input.notes,
    completed: input.completed ?? false,
    completedAt: input.completedAt,
    createdAt: now,
    updatedAt: now,
    updatedBy: deviceId,
    dueDate: input.dueDate,
    dueTime: input.dueTime,
    reminderAt: input.reminderAt,
    importance: input.importance ?? "normal",
    myDay: input.myDay ?? null,
    steps: input.steps ?? [],
    recurrence: input.recurrence,
    tags: input.tags,
    attachments: input.attachments,
    seriesId: input.seriesId,
    occurrenceKey: input.occurrenceKey,
    order: input.order ?? 0,
    sourceId: input.sourceId,
  };
}

export function createStep(deviceId: string, title: string, order: number): Step {
  return {
    id: uid("step"),
    title,
    completed: false,
    order,
    updatedAt: nowMs(),
    updatedBy: deviceId,
  };
}

export function createGroup(deviceId: string, name: string, order: number): TaskGroup {
  const now = nowMs();
  return {
    id: uid("group"),
    name,
    order,
    createdAt: now,
    updatedAt: now,
    updatedBy: deviceId,
  };
}

export function activeLists(db: DB): TaskList[] {
  return db.lists.filter((l) => !l.deletedAt).sort((a, b) => a.order - b.order);
}

export function activeGroups(db: DB): TaskGroup[] {
  return (db.groups ?? [])
    .filter((g) => !g.deletedAt)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function activeTasks(db: DB): Task[] {
  return db.tasks.filter((t) => !t.deletedAt);
}

export function tasksInList(db: DB, listId: string): Task[] {
  return activeTasks(db)
    .filter((t) => t.listId === listId)
    .sort((a, b) => a.order - b.order);
}

export function taskById(db: DB, id: string | null): Task | undefined {
  if (!id) return undefined;
  return db.tasks.find((t) => t.id === id);
}

export function listById(db: DB, id: string | null): TaskList | undefined {
  if (!id) return undefined;
  return db.lists.find((l) => l.id === id);
}

export function completeRatio(task: Task): number {
  if (task.steps.length === 0) return task.completed ? 1 : 0;
  return task.steps.filter((s) => s.completed).length / task.steps.length;
}
