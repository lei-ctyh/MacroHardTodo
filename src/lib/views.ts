import { matchesQuery } from "./search";
import {
  activeTasks,
  taskById,
  type DB,
  type SmartViewId,
  type SortKey,
  type Task,
  type TaskGroup,
  type TaskList,
} from "./model";
import { isOverdue, todayISO } from "./dates";

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

export function tasksForView(db: DB, view: View): Task[] {
  const all = activeTasks(db);
  if (view.type === "list") {
    return all
      .filter((t) => t.listId === view.id && !t.completed)
      .sort((a, b) => a.order - b.order);
  }
  switch (view.id) {
    case "myday":
      return all
        .filter((t) => !t.completed && t.myDay === todayISO())
        .sort((a, b) => a.order - b.order);
    case "important":
      return all
        .filter((t) => !t.completed && t.importance === "high")
        .sort((a, b) => a.order - b.order);
    case "planned":
      return all
        .filter((t) => !t.completed && (t.dueDate || t.reminderAt))
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

export function smartCounts(db: DB): Record<SmartViewId, number> {
  const all = activeTasks(db);
  return {
    myday: all.filter((t) => !t.completed && t.myDay === todayISO()).length,
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
  return activeTasks(db)
    .filter(
      (t) =>
        !t.completed &&
        t.myDay !== today &&
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
  const all = activeTasks(db).filter((t) => !t.completed && t.myDay !== today);
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
