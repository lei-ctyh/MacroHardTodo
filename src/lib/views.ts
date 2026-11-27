import { matchesQuery } from "./search";
import {
  activeGroups,
  activeLists,
  activeTasks,
  taskById,
  type DB,
  type SmartViewId,
  type SortKey,
  type Task,
  type TaskGroup,
  type TaskList,
  type ToggleableSmartViewId,
} from "./model";
import { addDaysISO, dateToISO, isOverdue, isoToDate, todayISO } from "./dates";

export type View =
  | { type: "smart"; id: SmartViewId }
  | { type: "list"; id: string };

/** 排序选项，顺序与 Microsoft To Do 一致 */
export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "importance", label: "重要" },
  { key: "due", label: "截止日期" },
  { key: "added", label: "已添加" },
  { key: "alpha", label: "字母顺序" },
  { key: "manual", label: "我的顺序" },
];

/** 视图在 settings.sortBy 中的键 */
export function viewKey(view: View): string {
  return `${view.type}:${view.id}`;
}

/** 比较截止日期：升序，无日期视为最大值。返回 -1 / 0 / 1 */
function compareDueDate(a: Task, b: Task): number {
  const dateA = a.dueDate ?? "9999-99-99";
  const dateB = b.dueDate ?? "9999-99-99";
  if (dateA === dateB) return 0;
  return dateA < dateB ? -1 : 1;
}

/** 稳定排序：相同比较结果保持 tasksForView 的原始顺序 */
export function sortTasks(tasks: Task[], sort: SortKey): Task[] {
  if (sort === "manual" || tasks.length < 2) return tasks.slice();
  const indexed = tasks.map((task, index) => ({ task, index }));
  indexed.sort((a, b) => {
    const diff = compareBySort(a.task, b.task, sort);
    return diff !== 0 ? diff : a.index - b.index;
  });
  return indexed.map((item) => item.task);
}

function compareBySort(a: Task, b: Task, sort: SortKey): number {
  switch (sort) {
    case "importance": {
      const rankA = a.importance === "high" ? 0 : 1;
      const rankB = b.importance === "high" ? 0 : 1;
      return rankA - rankB;
    }
    case "due": {
      const byDate = compareDueDate(a, b);
      if (byDate !== 0) return byDate;
      const timeA = a.dueTime ?? "99:99";
      const timeB = b.dueTime ?? "99:99";
      if (timeA !== timeB) return timeA < timeB ? -1 : 1;
      return 0;
    }
    case "added":
      return a.createdAt - b.createdAt;
    case "alpha":
      return a.title.localeCompare(b.title, "zh-CN", {
        sensitivity: "base",
        numeric: true,
      });
    case "manual":
    default:
      return 0;
  }
}

/** 判断任务是否属于「我的一天」：手动加入今天，或开启“今天截止自动显示”且今天到期 */
export function isTaskInMyDay(
  task: Task,
  today = todayISO(),
  includeDueToday = true,
): boolean {
  return task.myDay === today || (includeDueToday && task.dueDate === today);
}

/** 侧栏智能列表是否显示（兼顾逐项开关与“自动隐藏空列表”，当前激活视图保持可见） */
export function isSmartViewVisible(
  db: DB,
  id: ToggleableSmartViewId,
  counts: Record<SmartViewId, number>,
  activeView?: View,
): boolean {
  if (db.settings.smartListVisibility?.[id] === false) return false;
  if (db.settings.autoHideEmptySmartLists && (counts[id] ?? 0) === 0) {
    if (activeView?.type === "smart" && activeView.id === id) return true;
    return false;
  }
  return true;
}

export function tasksForView(db: DB, view: View): Task[] {
  const all = activeTasks(db);
  if (view.type === "list") {
    return all
      .filter((t) => t.listId === view.id && !t.completed)
      .sort((a, b) => a.order - b.order);
  }
  switch (view.id) {
    case "myday": {
      const today = todayISO();
      const includeDueToday = db.settings.showDueTodayInMyDay ?? true;
      return all
        .filter((t) => !t.completed && isTaskInMyDay(t, today, includeDueToday))
        .sort((a, b) => a.order - b.order);
    }
    case "important":
      return all
        .filter((t) => !t.completed && t.importance === "high")
        .sort((a, b) => a.order - b.order);
    case "planned":
      // 计划内把已完成任务也留在日期分组里（组内划线显示），智能计数仍只算未完成
      return all
        .filter((t) => t.dueDate || t.reminderAt)
        .sort((a, b) => compareDueDate(a, b) || a.order - b.order);
    case "completed":
      return all
        .filter((t) => t.completed)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    case "all":
    default:
      return all.filter((t) => !t.completed).sort((a, b) => a.order - b.order);
  }
}

export function searchTasks(tasks: Task[], query: string): Task[] {
  if (!query.trim()) return tasks;
  return tasks.filter((t) => matchesQuery(t, query));
}

/** 视图内的任务分组（计划内日期桶 / 全部与已完成按列表分组） */
export interface TaskSection {
  /** list:<id> | overdue | today | tomorrow | next5 | later */
  key: string;
  /** 组标题；全部/已完成为列表原始名称（保留开头 emoji） */
  title: string;
  /** 已按当前视图排序 */
  tasks: Task[];
}

export type PlannedBucketKey = "overdue" | "today" | "tomorrow" | "next5" | "later";

/** 计划内任务的生效日期：截止日期优先，否则取提醒时间的日期 */
function effectiveDate(task: Task): string | undefined {
  if (task.dueDate) return task.dueDate;
  if (task.reminderAt != null) return dateToISO(new Date(task.reminderAt));
  return undefined;
}

/** 计划内日期桶：逾期按日期比较（今天已过点仍留在「今天」） */
export function plannedBucketKey(
  task: Task,
  today: string,
  tomorrow: string,
  next5End: string,
): PlannedBucketKey {
  const date = effectiveDate(task);
  if (!date) return "later";
  if (date < today) return "overdue";
  if (date === today) return "today";
  if (date === tomorrow) return "tomorrow";
  if (date <= next5End) return "next5";
  return "later";
}

/** 计划内「接下来 5 天」标题：M月d日,周X到M月d日,周X */
export function plannedRangeTitle(start: Date, end: Date): string {
  const label = (d: Date) =>
    `${d.getMonth() + 1}月${d.getDate()}日,周${"日一二三四五六"[d.getDay()]}`;
  return `${label(start)}到${label(end)}`;
}

function byCompletedAtDesc(a: Task, b: Task): number {
  return (b.completedAt ?? 0) - (a.completedAt ?? 0);
}

function plannedSections(db: DB, view: View, tasks: Task[]): TaskSection[] {
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const next5End = addDaysISO(today, 6);
  const sort = db.settings.sortBy?.[viewKey(view)] ?? "manual";

  const buckets = new Map<PlannedBucketKey, Task[]>();
  for (const task of tasks) {
    const key = plannedBucketKey(task, today, tomorrow, next5End);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(task);
    else buckets.set(key, [task]);
  }

  const order: { key: PlannedBucketKey; title: string }[] = [
    { key: "overdue", title: "已逾期" },
    { key: "today", title: "今天" },
    { key: "tomorrow", title: "明天" },
    {
      key: "next5",
      title: plannedRangeTitle(
        isoToDate(addDaysISO(today, 2)),
        isoToDate(next5End),
      ),
    },
    { key: "later", title: "以后" },
  ];

  const sections: TaskSection[] = [];
  for (const { key, title } of order) {
    const bucket = buckets.get(key);
    if (!bucket || bucket.length === 0) continue;
    sections.push({ key, title, tasks: sortTasks(bucket, sort) });
  }
  return sections;
}

/** 按侧栏顺序把任务按列表分组；找不到所属列表的任务直接跳过 */
function listTaskSections(
  db: DB,
  view: View,
  tasks: Task[],
  completed: boolean,
): TaskSection[] {
  const lists = activeLists(db);
  const byId = new Map(lists.map((list) => [list.id, list]));
  const order = listSections(lists, activeGroups(db)).flatMap((s) => s.ids);
  const sort = db.settings.sortBy?.[viewKey(view)] ?? "manual";

  const buckets = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!byId.has(task.listId)) continue;
    const bucket = buckets.get(task.listId);
    if (bucket) bucket.push(task);
    else buckets.set(task.listId, [task]);
  }

  const sections: TaskSection[] = [];
  for (const id of order) {
    const bucket = buckets.get(id);
    if (!bucket || bucket.length === 0) continue;
    sections.push({
      key: `list:${id}`,
      title: byId.get(id)!.name,
      tasks: completed
        ? bucket.slice().sort(byCompletedAtDesc)
        : sortTasks(bucket, sort),
    });
  }
  return sections;
}

/** 需要分组的视图返回分组；平铺视图返回 [] */
export function sectionsForView(
  db: DB,
  view: View,
  tasks: Task[],
): TaskSection[] {
  if (view.type !== "smart") return [];
  switch (view.id) {
    case "planned":
      return plannedSections(db, view, tasks);
    case "all":
      return listTaskSections(db, view, tasks, false);
    case "completed":
      return listTaskSections(db, view, tasks, true);
    default:
      return [];
  }
}

/**
 * 视图分组的默认折叠状态（本地未记录时使用）。
 * 平铺视图（列表 / 我的一天 / 重要）底部的「已完成」区默认折叠，与旧行为一致；
 * 计划内 / 全部 / 已完成的列表或日期分组默认展开。
 */
export function defaultCollapsedSections(viewKey: string): string[] {
  return viewKey.startsWith("list:") ||
    viewKey === "smart:myday" ||
    viewKey === "smart:important"
    ? ["completed"]
    : [];
}

/** 底部「已完成 N」区；返回 [] 表示该视图不显示已完成区 */
export function completedTasksForView(db: DB, view: View): Task[] {
  const all = activeTasks(db);
  if (view.type === "list") {
    return all
      .filter((t) => t.listId === view.id && t.completed)
      .sort(byCompletedAtDesc);
  }
  switch (view.id) {
    case "myday": {
      const today = todayISO();
      const includeDueToday = db.settings.showDueTodayInMyDay ?? true;
      return all
        .filter((t) => t.completed && isTaskInMyDay(t, today, includeDueToday))
        .sort(byCompletedAtDesc);
    }
    case "important":
      return all
        .filter((t) => t.completed && t.importance === "high")
        .sort(byCompletedAtDesc);
    case "planned":
    case "all":
    case "completed":
    default:
      return [];
  }
}

export function smartCounts(db: DB): Record<SmartViewId, number> {
  const all = activeTasks(db);
  const today = todayISO();
  const includeDueToday = db.settings.showDueTodayInMyDay ?? true;
  return {
    myday: all.filter((t) => !t.completed && isTaskInMyDay(t, today, includeDueToday))
      .length,
    important: all.filter((t) => !t.completed && t.importance === "high").length,
    planned: all.filter((t) => !t.completed && (t.dueDate || t.reminderAt)).length,
    all: all.filter((t) => !t.completed).length,
    completed: all.filter((t) => t.completed).length,
  };
}

export function listCounts(db: DB): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of activeTasks(db)) {
    if (!t.completed) counts[t.listId] = (counts[t.listId] ?? 0) + 1;
  }
  return counts;
}

/** 侧栏分组区块：未分组在最前，其后按分组创建顺序排列 */
export interface ListSection {
  key: string;
  groupId?: string;
  ids: string[];
}

export const UNGROUPED_SECTION_KEY = "ungrouped";

export function listSections(
  lists: TaskList[],
  groups: TaskGroup[],
): ListSection[] {
  const known = new Set(groups.map((g) => g.id));
  const ungrouped: string[] = [];
  const byGroup = new Map<string, string[]>();
  for (const group of groups) byGroup.set(group.id, []);
  for (const list of lists) {
    if (list.groupId && known.has(list.groupId)) {
      const bucket = byGroup.get(list.groupId);
      if (bucket) bucket.push(list.id);
    } else {
      ungrouped.push(list.id);
    }
  }
  return [
    { key: UNGROUPED_SECTION_KEY, groupId: undefined, ids: ungrouped },
    ...groups.map((group) => ({
      key: group.id,
      groupId: group.id,
      ids: byGroup.get(group.id) ?? [],
    })),
  ];
}

/**
 * 计算拖拽后的分组区块顺序。
 * `overId` 为列表 id 时插入到该列表位置；为 `group:<key>` 时追加到该分组末尾。
 * 返回新的区块数组，找不到目标时返回 null。
 */
export function moveList(
  sections: ListSection[],
  activeId: string,
  overId: string,
): ListSection[] | null {
  const next = sections.map((section) => ({ ...section, ids: [...section.ids] }));
  const source = next.find((section) => section.ids.includes(activeId));
  if (!source) return null;

  const isGroupDrop = overId.startsWith("group:");
  const target = isGroupDrop
    ? next.find((section) => section.key === overId.slice("group:".length))
    : next.find((section) => section.ids.includes(overId));
  if (!target) return null;

  if (source === target) {
    const fromIdx = target.ids.indexOf(activeId);
    const toIdx = isGroupDrop ? target.ids.length - 1 : target.ids.indexOf(overId);
    if (fromIdx < 0 || toIdx < 0) return null;
    const [moved] = target.ids.splice(fromIdx, 1);
    target.ids.splice(toIdx, 0, moved);
  } else {
    const fromIdx = source.ids.indexOf(activeId);
    if (fromIdx < 0) return null;
    const [moved] = source.ids.splice(fromIdx, 1);
    if (isGroupDrop) {
      target.ids.push(moved);
    } else {
      const toIdx = target.ids.indexOf(overId);
      target.ids.splice(toIdx < 0 ? target.ids.length : toIdx, 0, moved);
    }
  }
  return next;
}

/** 我的一天建议：昨天未完成 + 今天到期，排除已在 My Day 中的任务 */
export function myDaySuggestions(db: DB): Task[] {
  const today = todayISO();
  const includeDueToday = db.settings.showDueTodayInMyDay ?? true;
  return activeTasks(db)
    .filter(
      (t) =>
        !t.completed &&
        !isTaskInMyDay(t, today, includeDueToday) &&
        (t.dueDate === today || isOverdue(t.dueDate, t.dueTime)),
    )
    .sort((a, b) => compareDueDate(a, b) || a.order - b.order);
}

export function headerInfo(
  db: DB,
  view: View,
): { title: string; subtitle?: string } {
  if (view.type === "list") {
    const list = db.lists.find((l) => l.id === view.id && !l.deletedAt);
    return { title: list?.name ?? "列表" };
  }
  switch (view.id) {
    case "myday":
      return { title: "我的一天", subtitle: todayISO() };
    case "important":
      return { title: "重要" };
    case "planned":
      return { title: "计划内" };
    case "completed":
      return { title: "已完成" };
    case "all":
    default:
      return { title: "全部" };
  }
}

export function stepProgress(task: Task | undefined): { done: number; total: number } {
  if (!task) return { done: 0, total: 0 };
  const steps = task.steps.filter((s) => !s.deletedAt);
  return { done: steps.filter((s) => s.completed).length, total: steps.length };
}

export interface SuggestionGroup {
  title: string;
  tasks: Task[];
}

/** 「我的一天」右侧建议：按逾期、今天、稍后、最近添加、其他分组 */
export function myDaySuggestionGroups(db: DB): SuggestionGroup[] {
  const today = todayISO();
  const includeDueToday = db.settings.showDueTodayInMyDay ?? true;
  const all = activeTasks(db).filter(
    (t) => !t.completed && !isTaskInMyDay(t, today, includeDueToday),
  );
  const used = new Set<string>();

  const take = (pred: (t: Task) => boolean, limit = 30): Task[] => {
    const out: Task[] = [];
    for (const task of all) {
      if (out.length >= limit) break;
      if (used.has(task.id) || !pred(task)) continue;
      used.add(task.id);
      out.push(task);
    }
    return out;
  };

  const overdue = take((t) => Boolean(t.dueDate && t.dueDate < today));
  const dueToday = take((t) => t.dueDate === today);
  const later = take((t) => Boolean(t.dueDate && t.dueDate > today));
  const recent = take((t) => !t.dueDate && t.createdAt > Date.now() - 14 * 86400000);
  const rest = take(() => true, 20);

  return [
    { title: "已逾期", tasks: overdue },
    { title: "今天到期", tasks: dueToday },
    { title: "稍后", tasks: later },
    { title: "最近添加", tasks: recent },
    { title: "其他任务", tasks: rest },
  ].filter((group) => group.tasks.length > 0);
}
