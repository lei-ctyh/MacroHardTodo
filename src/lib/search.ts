import type { Task } from "./model";

export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

export function matchesQuery(task: Task, query: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  const haystack = [
    task.title,
    task.notes ?? "",
    ...(task.tags ?? []),
    ...task.steps.filter((s) => !s.deletedAt).map((s) => s.title),
  ]
    .join("\n")
    .toLowerCase();
  return q.split(/\s+/).every((part) => haystack.includes(part));
}
