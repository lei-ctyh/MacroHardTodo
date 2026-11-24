import { matchesQuery } from "./search";
import {
  activeTasks,
  taskById,
  type DB,
  type SmartViewId,
  type Task,
} from "./model";
import { isOverdue, todayISO } from "./dates";

export type View =
  | { type: "smart"; id: SmartViewId }
  | { type: "list"; id: string };

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
        .sort((a, b) => {
          const da = a.dueDate ?? "9999-99-99";
          const db2 = b.dueDate ?? "9999-99-99";
          if (da !== db2) return da < db2 ? -1 : 1;
          return a.order - b.order;
        });
    case "completed":
      return all
        .filter((t) => t.completed)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    case "tasks":
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
    tasks: all.filter((t) => !t.completed).length,
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
    .sort((a, b) => {
      const da = a.dueDate ?? "9999-99-99";
      const db2 = b.dueDate ?? "9999-99-99";
      return da < db2 ? -1 : da > db2 ? 1 : a.order - b.order;
    });
}

export function headerInfo(
  db: DB,
  view: View,
): { title: string; subtitle?: string; color?: string } {
  if (view.type === "list") {
    const list = db.lists.find((l) => l.id === view.id && !l.deletedAt);
    return { title: list?.name ?? "列表", color: list?.color };
  }
  switch (view.id) {
    case "myday":
      return { title: "我的一天", subtitle: todayISO() };
    case "important":
      return { title: "重要" };
    case "planned":
      return { title: "计划中" };
    case "completed":
      return { title: "已完成" };
    case "tasks":
    default:
      return { title: "任务" };
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
