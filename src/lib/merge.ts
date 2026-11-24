import {
  type Attachment,
  type DB,
  type Step,
  type Task,
  type TaskGroup,
  type TaskList,
} from "./model";

interface Entity {
  id: string;
  order?: number;
  updatedAt: number;
  updatedBy?: string;
  deletedAt?: number;
}

const TOMBSTONE_TTL = 60 * 86400000; // 60 天

function pickNewer<T extends Entity>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  const ua = a.updatedBy ?? "";
  const ub = b.updatedBy ?? "";
  if (ua !== ub) return ua > ub ? a : b;
  return a;
}

function mergeEntities<T extends Entity>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of a) map.set(item.id, item);
  for (const item of b) {
    const existing = map.get(item.id);
    map.set(item.id, existing ? pickNewer(existing, item) : item);
  }
  return [...map.values()];
}

function sortByOrder<T extends Entity>(items: T[]): T[] {
  return [...items].sort((x, y) => {
    const ox = x.order ?? 0;
    const oy = y.order ?? 0;
    if (ox !== oy) return ox - oy;
    return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
  });
}

function mergeSteps(local: Step[], remote: Step[]): Step[] {
  return mergeEntities(local, remote).sort((a, b) => a.order - b.order);
}

function mergeAttachments(local: Attachment[], remote: Attachment[]): Attachment[] {
  return mergeEntities(local, remote).sort((a, b) => a.id.localeCompare(b.id));
}

function mergeTasks(local: Task[], remote: Task[]): Task[] {
  const map = new Map<string, Task>();
  for (const t of local) map.set(t.id, t);
  for (const remoteTask of remote) {
    const localTask = map.get(remoteTask.id);
    if (!localTask) {
      map.set(remoteTask.id, remoteTask);
      continue;
    }
    const base = pickNewer(localTask, remoteTask);
    map.set(remoteTask.id, {
      ...base,
      steps: mergeSteps(localTask.steps ?? [], remoteTask.steps ?? []),
      attachments: mergeAttachments(
        localTask.attachments ?? [],
        remoteTask.attachments ?? [],
      ),
    });
  }
  return [...map.values()];
}

/** 两台设备都生成了同一重复实例时，只保留一份 */
function dedupeOccurrences(tasks: Task[]): Task[] {
  const byKey = new Map<string, Task>();
  const result: Task[] = [];
  for (const task of tasks) {
    if (!task.occurrenceKey) {
      result.push(task);
      continue;
    }
    const existing = byKey.get(task.occurrenceKey);
    if (!existing) {
      byKey.set(task.occurrenceKey, task);
      result.push(task);
    } else {
      const winner = pickNewer(existing, task);
      byKey.set(task.occurrenceKey, winner);
      const idx = result.indexOf(existing);
      if (idx >= 0) result[idx] = winner;
    }
  }
  return result;
}

function purgeTombstones<T extends Entity>(items: T[], now: number): T[] {
  return items.filter((it) => !it.deletedAt || now - it.deletedAt < TOMBSTONE_TTL);
}

function mergeShared(local: DB["shared"], remote: DB["shared"]): DB["shared"] {
  const out: DB["shared"] = { ...local };
  for (const [key, rv] of Object.entries(remote ?? {})) {
    const lv = out[key];
    if (!lv) {
      out[key] = rv;
      continue;
    }
    if (rv.updatedAt > lv.updatedAt) out[key] = rv;
    else if (rv.updatedAt === lv.updatedAt && (rv.updatedBy ?? "") > (lv.updatedBy ?? ""))
      out[key] = rv;
  }
  return out;
}

export interface MergeOutcome {
  db: DB;
  changed: boolean;
}

/** 合并本地与远端文档；本地设置（窗口/界面）不被覆盖 */
export function mergeDB(local: DB, remote: DB): MergeOutcome {
  const now = Date.now();
  const lists: TaskList[] = sortByOrder(
    purgeTombstones(mergeEntities(local.lists ?? [], remote.lists ?? []), now),
  );
  const groups: TaskGroup[] = sortByOrder(
    purgeTombstones(mergeEntities(local.groups ?? [], remote.groups ?? []), now),
  );
  const tasks = sortByOrder(
    purgeTombstones(dedupeOccurrences(mergeTasks(local.tasks ?? [], remote.tasks ?? [])), now),
  );
  const shared = mergeShared(local.shared ?? {}, remote.shared ?? {});

  const merged: DB = {
    schemaVersion: 1,
    deviceId: local.deviceId,
    lists,
    groups,
    tasks,
    shared,
    settings: local.settings,
  };

  return { db: merged, changed: fingerprint(merged) !== fingerprint(local) };
}

/** 用于判断同步是否有实际变化的稳定指纹 */
export function fingerprint(db: DB): string {
  return JSON.stringify({
    lists: [...db.lists].sort((a, b) => a.id.localeCompare(b.id)),
    groups: [...(db.groups ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    tasks: [...db.tasks]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((t) => ({
        ...t,
        steps: [...t.steps].sort((x, y) => x.id.localeCompare(y.id)),
        attachments: [...(t.attachments ?? [])].sort((x, y) => x.id.localeCompare(y.id)),
      })),
    shared: db.shared,
  });
}
