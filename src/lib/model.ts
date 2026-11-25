export type ID = string;

/** 列表排序方式：我的顺序 / 重要 / 截止日期 / 已添加 / 字母顺序 */
export type SortKey = "manual" | "importance" | "due" | "added" | "alpha";

export const SMART_VIEWS = ["myday", "important", "planned", "all", "completed"] as const;
export type SmartViewId = (typeof SMART_VIEWS)[number];

/** 固定默认清单：不属于任何清单的新任务都进入这里 */
export const DEFAULT_LIST_ID = "list_default";

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
  /** 渐变主题背景（CSS background 值） */
  color?: string;
}

export interface TaskList {
  id: string;
  name: string;
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
  /** 本地头像；仅本地保存 */
  avatar?: ThemeImage;
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

export interface ThemeColor {
  name: string;
  value: string;
  /** 浅色背景：标题和操作区使用深色文字 */
  light?: boolean;
}

export const THEME_COLORS: ThemeColor[] = [
  {
    name: "蓝",
    value: "linear-gradient(135deg, #7d97dd 0%, #6c8cd5 50%, #5f7dc6 100%)",
  },
  {
    name: "紫",
    value: "linear-gradient(135deg, #b47fc2 0%, #a66bb5 50%, #965ca5 100%)",
  },
  {
    name: "玫红",
    value: "linear-gradient(135deg, #dc7f9b 0%, #d16a8a 50%, #c05677 100%)",
  },
  {
    name: "红",
    value: "linear-gradient(135deg, #d46d6d 0%, #c85a5a 50%, #b84a4a 100%)",
  },
  {
    name: "绿",
    value: "linear-gradient(135deg, #589a73 0%, #4a8a64 50%, #3e7a57 100%)",
  },
  {
    name: "青",
    value: "linear-gradient(135deg, #479995 0%, #3a8a86 50%, #317774 100%)",
  },
  {
    name: "灰",
    value: "linear-gradient(135deg, #8797a5 0%, #7a8a99 50%, #6c7c8a 100%)",
  },
  {
    name: "浅蓝",
    light: true,
    value: "linear-gradient(135deg, #d3e0f5 0%, #c8d8f0 50%, #b9cde8 100%)",
  },
  {
    name: "淡紫",
    light: true,
    value: "linear-gradient(135deg, #e8e0f5 0%, #e0d6f0 50%, #d4c8e8 100%)",
  },
  {
    name: "浅粉",
    light: true,
    value: "linear-gradient(135deg, #f5e2e9 0%, #f0d6e0 50%, #e6c8d4 100%)",
  },
  {
    name: "杏",
    light: true,
    value: "linear-gradient(135deg, #f5e2d7 0%, #f0d6c8 50%, #e6c8b8 100%)",
  },
  {
    name: "薄荷",
    light: true,
    value: "linear-gradient(135deg, #e0f5ee 0%, #d6f0e6 50%, #c8e6da 100%)",
  },
  {
    name: "浅青",
    light: true,
    value: "linear-gradient(135deg, #dcefef 0%, #d0e8e8 50%, #c0dede 100%)",
  },
  {
    name: "浅灰",
    light: true,
    value: "linear-gradient(135deg, #f0f0f0 0%, #e8e8e8 50%, #dcdcdc 100%)",
  },
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

/** 确保固定的「任务」默认清单存在；被误删时恢复 */
export function ensureDefaultList(db: DB): DB {
  const deviceId = db.deviceId;
  const now = nowMs();
  const existing = db.lists.find((l) => l.id === DEFAULT_LIST_ID);
  if (!existing) {
    return {
      ...db,
      lists: [
        ...db.lists,
        {
          id: DEFAULT_LIST_ID,
          name: "任务",
          order: 0,
          createdAt: now,
          updatedAt: now,
          updatedBy: deviceId,
        },
      ],
    };
  }
  if (existing.deletedAt) {
    return {
      ...db,
      lists: db.lists.map((l) =>
        l.id === DEFAULT_LIST_ID
          ? {
              ...l,
              name: l.name || "任务",
              deletedAt: undefined,
              updatedAt: now,
              updatedBy: deviceId,
            }
          : l,
      ),
    };
  }
  return db;
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
    id: DEFAULT_LIST_ID,
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
