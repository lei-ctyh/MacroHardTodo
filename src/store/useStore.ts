import { create } from "zustand";
import Papa from "papaparse";
import { api } from "../lib/api";
import {
  DEFAULT_SETTINGS,
  activeGroups,
  activeLists,
  activeTasks,
  createDB,
  createGroup,
  createStep,
  createTask,
  newDeviceId,
  nowMs,
  uid,
  type DB,
  type ListTheme,
  type Settings,
  type SortKey,
  type Step,
  type Task,
} from "../lib/model";
import { buildNextTask, nextDateForTask } from "../lib/recurrence";
import { mergeDB } from "../lib/merge";
import { doSync, resolveDataUrl, type SyncConfig } from "../lib/syncClient";
import type { View } from "../lib/views";
import { todayISO } from "../lib/dates";

const LS_KEY = "macrohard-todo-db";
const DEVICE_KEY = "mht-device-id";
const UPLOADED_KEY = "mht-uploaded-attachments";

export type DialogKind = "settings" | "sync" | "migration" | null;

interface SyncStatus {
  running: boolean;
  message: string | null;
  error: string | null;
}

export interface StoreState {
  db: DB;
  ready: boolean;
  view: View;
  selectedTaskId: string | null;
  query: string;
  saving: "idle" | "saving" | "saved" | "error";
  saveError: string | null;
  sync: SyncStatus;
  dialog: DialogKind;
  quickAddNonce: number;
  loadWarning: string | null;

  init: () => Promise<void>;
  setView: (view: View) => void;
  selectTask: (id: string | null) => void;
  setQuery: (q: string) => void;
  openDialog: (dialog: DialogKind) => void;
  focusQuickAdd: () => void;

  addList: (name: string) => string | null;
  renameList: (id: string, name: string) => void;
  setListColor: (id: string, color: string) => void;
  setListTheme: (id: string, theme: ListTheme | undefined) => void;
  setShared: (key: string, value: unknown) => void;
  deleteList: (id: string) => void;
  reorganizeLists: (entries: { id: string; groupId?: string }[]) => void;

  addGroup: (name?: string) => string;
  renameGroup: (id: string, name: string) => void;
  deleteGroup: (id: string) => void;
  toggleGroupCollapsed: (id: string) => void;

  addTask: (input: {
    listId: string;
    title: string;
    dueDate?: string;
    myDay?: boolean;
    importance?: "normal" | "high";
  }) => string | null;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleComplete: (id: string) => void;
  deleteTask: (id: string) => void;
  restoreTask: (id: string) => void;
  reorderTasks: (listId: string, ids: string[]) => void;
  moveTask: (id: string, listId: string) => void;
  duplicateTask: (id: string) => void;
  toggleImportance: (id: string) => void;
  setMyDay: (id: string, date: string | null) => void;

  addStep: (taskId: string, title: string) => void;
  updateStep: (taskId: string, stepId: string, patch: Partial<Step>) => void;
  toggleStep: (taskId: string, stepId: string) => void;
  deleteStep: (taskId: string, stepId: string) => void;
  reorderSteps: (taskId: string, ids: string[]) => void;

  addAttachment: (taskId: string, srcPath: string) => Promise<void>;
  removeAttachment: (taskId: string, attachmentId: string) => void;
  ensureAttachment: (relPath: string) => Promise<boolean>;

  updateSettings: (patch: Partial<Settings>) => void;
  setSort: (key: string, sort: SortKey) => void;

  exportJson: (path: string) => Promise<void>;
  importJson: (path: string) => Promise<void>;
  exportCsv: (path: string) => Promise<void>;
  importCsv: (path: string) => Promise<void>;

  syncNow: () => Promise<void>;
  replaceDb: (db: DB) => void;
}

function normalizeDb(raw: Partial<DB>): DB {
  return {
    schemaVersion: 1,
    deviceId: raw.deviceId || newDeviceId(),
    lists: Array.isArray(raw.lists) ? raw.lists : [],
    groups: Array.isArray(raw.groups) ? raw.groups : [],
    tasks: Array.isArray(raw.tasks)
      ? raw.tasks.map((t) => ({
          ...t,
          steps: Array.isArray(t.steps) ? t.steps : [],
          attachments: Array.isArray(t.attachments) ? t.attachments : [],
        }))
      : [],
    shared: raw.shared && typeof raw.shared === "object" ? raw.shared : {},
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let initializing = false;

async function remoteBase(settings: Settings): Promise<string> {
  return resolveDataUrl(settings.webdavUrl ?? "").replace(/data\.json$/, "");
}

export const useStore = create<StoreState>((set, get) => {
  const persist = async (db: DB) => {
    set({ saving: "saving" });
    try {
      await api.saveDb(db);
      set({ saving: "saved", saveError: null });
    } catch (err) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(db));
      } catch {
        /* ignore */
      }
      set({ saving: "error", saveError: String(err) });
    }
  };

  const schedule = (db: DB, immediate = false) => {
    if (saveTimer) clearTimeout(saveTimer);
    if (immediate) {
      void persist(db);
      return;
    }
    saveTimer = setTimeout(() => void persist(db), 300);
  };

  const commit = (fn: (db: DB) => DB, immediate = false) => {
    const next = fn(get().db);
    set({ db: next });
    schedule(next, immediate);
  };

  const touch = (deviceId: string) => ({
    updatedAt: nowMs(),
    updatedBy: deviceId,
  });

  const updateTaskWith = (id: string, fn: (t: Task, deviceId: string) => Task) => {
    commit((db) => ({
      ...db,
      tasks: db.tasks.map((t) => (t.id === id ? fn(t, db.deviceId) : t)),
    }));
  };

  const defaultListId = (): string | null => {
    const { db, view } = get();
    if (view.type === "list") return view.id;
    const first = activeLists(db)[0];
    return first?.id ?? null;
  };

  return {
    db: createDB(
      (typeof localStorage !== "undefined" && localStorage.getItem(DEVICE_KEY)) ||
        newDeviceId(),
    ),
    ready: false,
    view: { type: "smart", id: "myday" },
    selectedTaskId: null,
    query: "",
    saving: "idle",
    saveError: null,
    sync: { running: false, message: null, error: null },
    dialog: null,
    quickAddNonce: 0,
    loadWarning: null,

    init: async () => {
      if (get().ready || initializing) return;
      initializing = true;
      let raw: Partial<DB> | null = null;
      let warning: string | null = null;
      try {
        const res = await api.loadDb();
        raw = res.db;
        warning = res.warning ?? null;
      } catch {
        try {
          const text = localStorage.getItem(LS_KEY);
          if (text) raw = JSON.parse(text) as DB;
        } catch {
          raw = null;
        }
      }
      if (!raw) {
        const stored =
          (typeof localStorage !== "undefined" && localStorage.getItem(DEVICE_KEY)) ||
          newDeviceId();
        try {
          localStorage.setItem(DEVICE_KEY, stored);
        } catch {
          /* ignore */
        }
        raw = createDB(stored);
      }
      const db = normalizeDb(raw);
      try {
        localStorage.setItem(DEVICE_KEY, db.deviceId);
      } catch {
        /* ignore */
      }
      set({ db, ready: true, loadWarning: warning });
      void persist(db);

      // 自动清理过期已完成任务（软删除，保证多端一致）
      const days = db.settings.autoPurgeCompletedDays;
      if (days > 0) {
        const cutoff = nowMs() - days * 86400000;
        const stale = db.tasks.filter(
          (t) => t.completed && !t.deletedAt && t.completedAt && t.completedAt < cutoff,
        );
        if (stale.length > 0) {
          const ids = new Set(stale.map((t) => t.id));
          commit(
            (d) => ({
              ...d,
              tasks: d.tasks.map((t) =>
                ids.has(t.id)
                  ? { ...t, deletedAt: nowMs(), ...touch(d.deviceId) }
                  : t,
              ),
            }),
            true,
          );
        }
      }
      initializing = false;
    },

    setView: (view) => set({ view, selectedTaskId: null, query: "" }),
    selectTask: (id) => set({ selectedTaskId: id }),
    setQuery: (q) => set({ query: q }),
    openDialog: (dialog) => set({ dialog }),
    focusQuickAdd: () => set((s) => ({ quickAddNonce: s.quickAddNonce + 1 })),

    addList: (name) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const db = get().db;
      const order =
        Math.max(-1, ...activeLists(db).map((l) => l.order)) + 1;
      const now = nowMs();
      const id = uid("list");
      commit((d) => ({
        ...d,
        lists: [
          ...d.lists,
          {
            id,
            name: trimmed,
            order,
            createdAt: now,
            updatedAt: now,
            updatedBy: d.deviceId,
          },
        ],
      }));
      return id;
    },

    renameList: (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      commit((db) => ({
        ...db,
        lists: db.lists.map((l) =>
          l.id === id ? { ...l, name: trimmed, ...touch(db.deviceId) } : l,
        ),
      }));
    },

    setListColor: (id, color) => {
      commit((db) => ({
        ...db,
        lists: db.lists.map((l) =>
          l.id === id ? { ...l, color, ...touch(db.deviceId) } : l,
        ),
      }));
    },

    setListTheme: (id, theme) => {
      commit((db) => ({
        ...db,
        lists: db.lists.map((l) =>
          l.id === id ? { ...l, theme, ...touch(db.deviceId) } : l,
        ),
      }));
    },

    setShared: (key, value) => {
      commit((db) => ({
        ...db,
        shared: {
          ...db.shared,
          [key]: { value, updatedAt: nowMs(), updatedBy: db.deviceId },
        },
      }));
    },

    deleteList: (id) => {
      const db = get().db;
      if (activeLists(db).length <= 1) return;
      const now = nowMs();
      commit((d) => ({
        ...d,
        lists: d.lists.map((l) =>
          l.id === id ? { ...l, deletedAt: now, ...touch(d.deviceId) } : l,
        ),
        tasks: d.tasks.map((t) =>
          t.listId === id && !t.deletedAt
            ? { ...t, deletedAt: now, ...touch(d.deviceId) }
            : t,
        ),
      }));
      if (get().view.type === "list" && (get().view as { id: string }).id === id) {
        const first = activeLists(get().db)[0];
        set({
          view: first
            ? { type: "list", id: first.id }
            : { type: "smart", id: "myday" },
          selectedTaskId: null,
        });
      }
    },

    reorganizeLists: (entries) => {
      const orderMap = new Map(entries.map((entry, index) => [entry.id, index]));
      const groupMap = new Map(entries.map((entry) => [entry.id, entry.groupId]));
      commit((db) => ({
        ...db,
        lists: db.lists.map((l) =>
          orderMap.has(l.id)
            ? {
                ...l,
                order: orderMap.get(l.id)!,
                groupId: groupMap.get(l.id),
                ...touch(db.deviceId),
              }
            : l,
        ),
      }));
    },

    addGroup: (name) => {
      const db = get().db;
      const trimmed = name?.trim() || "未命名的组";
      const order = Math.max(-1, ...activeGroups(db).map((g) => g.order)) + 1;
      const group = createGroup(db.deviceId, trimmed, order);
      commit((d) => ({
        ...d,
        groups: [...d.groups, group],
        settings: {
          ...d.settings,
          collapsedGroups: (d.settings.collapsedGroups ?? []).filter(
            (id) => id !== group.id,
          ),
        },
      }));
      return group.id;
    },

    renameGroup: (id, name) => {
      const trimmed = name.trim() || "未命名的组";
      commit((db) => ({
        ...db,
        groups: db.groups.map((g) =>
          g.id === id ? { ...g, name: trimmed, ...touch(db.deviceId) } : g,
        ),
      }));
    },

    deleteGroup: (id) => {
      const now = nowMs();
      commit((d) => {
        // 只删除分组：列表保留并回到未分组区域，按原组内顺序追加到末尾
        const moving = d.lists
          .filter((l) => l.groupId === id && !l.deletedAt)
          .sort((a, b) => a.order - b.order);
        let nextOrder =
          Math.max(
            -1,
            ...d.lists
              .filter((l) => !l.deletedAt && !l.groupId)
              .map((l) => l.order),
          ) + 1;
        const movedOrders = new Map<string, number>();
        for (const list of moving) movedOrders.set(list.id, nextOrder++);

        return {
          ...d,
          groups: d.groups.map((g) =>
            g.id === id ? { ...g, deletedAt: now, ...touch(d.deviceId) } : g,
          ),
          lists: d.lists.map((l) =>
            movedOrders.has(l.id)
              ? {
                  ...l,
                  groupId: undefined,
                  order: movedOrders.get(l.id)!,
                  ...touch(d.deviceId),
                }
              : l,
          ),
          settings: {
            ...d.settings,
            collapsedGroups: (d.settings.collapsedGroups ?? []).filter(
              (gid) => gid !== id,
            ),
          },
        };
      });
    },

    toggleGroupCollapsed: (id) => {
      commit((db) => {
        const current = db.settings.collapsedGroups ?? [];
        const collapsedGroups = current.includes(id)
          ? current.filter((gid) => gid !== id)
          : [...current, id];
        return { ...db, settings: { ...db.settings, collapsedGroups } };
      });
    },

    addTask: ({ listId, title, dueDate, myDay, importance }) => {
      const trimmed = title.trim();
      if (!trimmed) return null;
      const db = get().db;
      if (!db.lists.some((l) => l.id === listId && !l.deletedAt)) return null;
      const order =
        Math.max(-1, ...activeTasks(db).filter((t) => t.listId === listId).map((t) => t.order)) + 1;
      const task = createTask(db.deviceId, {
        listId,
        title: trimmed,
        dueDate,
        myDay: myDay ? todayISO() : null,
        importance: importance ?? "normal",
        order,
      });
      commit((d) => ({ ...d, tasks: [...d.tasks, task] }));
      return task.id;
    },

    updateTask: (id, patch) => {
      updateTaskWith(id, (t, deviceId) => ({ ...t, ...patch, ...touch(deviceId) }));
    },

    toggleComplete: (id) => {
      const db = get().db;
      const task = db.tasks.find((t) => t.id === id && !t.deletedAt);
      if (!task) return;
      const now = nowMs();
      if (!task.completed) {
        let nextTask: Task | null = null;
        const nextDate = nextDateForTask(task);
        if (nextDate) {
          const key = `${task.seriesId ?? task.id}:${nextDate}`;
          const exists = db.tasks.some(
            (t) => !t.deletedAt && t.occurrenceKey === key,
          );
          if (!exists) nextTask = buildNextTask(db.deviceId, task, nextDate);
        }
        commit((d) => ({
          ...d,
          tasks: [
            ...d.tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    completed: true,
                    completedAt: now,
                    ...touch(d.deviceId),
                  }
                : t,
            ),
            ...(nextTask ? [nextTask] : []),
          ],
        }));
      } else {
        commit((d) => ({
          ...d,
          tasks: d.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  completed: false,
                  completedAt: undefined,
                  ...touch(d.deviceId),
                }
              : t,
          ),
        }));
      }
    },

    deleteTask: (id) => {
      const now = nowMs();
      updateTaskWith(id, (t, deviceId) => ({
        ...t,
        deletedAt: now,
        ...touch(deviceId),
      }));
      if (get().selectedTaskId === id) set({ selectedTaskId: null });
    },

    restoreTask: (id) => {
      updateTaskWith(id, (t, deviceId) => ({
        ...t,
        deletedAt: undefined,
        completed: false,
        completedAt: undefined,
        ...touch(deviceId),
      }));
    },

    reorderTasks: (listId, ids) => {
      commit((db) => {
        const orderMap = new Map(ids.map((id, index) => [id, index]));
        return {
          ...db,
          tasks: db.tasks.map((t) =>
            t.listId === listId && orderMap.has(t.id)
              ? { ...t, order: orderMap.get(t.id)!, ...touch(db.deviceId) }
              : t,
          ),
        };
      });
    },

    moveTask: (id, listId) => {
      const db = get().db;
      const order =
        Math.max(
          -1,
          ...activeTasks(db).filter((t) => t.listId === listId).map((t) => t.order),
        ) + 1;
      updateTaskWith(id, (t, deviceId) => ({
        ...t,
        listId,
        order,
        ...touch(deviceId),
      }));
    },

    duplicateTask: (id) => {
      const db = get().db;
      const src = db.tasks.find((t) => t.id === id && !t.deletedAt);
      if (!src) return;
      const now = nowMs();
      const copy: Task = {
        ...src,
        id: uid("task"),
        title: src.title,
        completed: false,
        completedAt: undefined,
        createdAt: now,
        updatedAt: now,
        updatedBy: db.deviceId,
        myDay: null,
        steps: src.steps
          .filter((s) => !s.deletedAt)
          .map((s, i) => ({
            ...s,
            id: uid("step"),
            completed: false,
            order: i,
            updatedAt: now,
            updatedBy: db.deviceId,
            deletedAt: undefined,
          })),
        attachments: (src.attachments ?? []).filter((a) => !a.deletedAt),
        seriesId: undefined,
        occurrenceKey: undefined,
        sourceId: undefined,
        order: src.order + 0.5,
      };
      commit((d) => ({ ...d, tasks: [...d.tasks, copy] }));
    },

    toggleImportance: (id) => {
      updateTaskWith(id, (t, deviceId) => ({
        ...t,
        importance: t.importance === "high" ? "normal" : "high",
        ...touch(deviceId),
      }));
    },

    setMyDay: (id, date) => {
      updateTaskWith(id, (t, deviceId) => ({
        ...t,
        myDay: date,
        ...touch(deviceId),
      }));
    },

    addStep: (taskId, title) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const deviceId = get().db.deviceId;
      updateTaskWith(taskId, (t) => {
        const order =
          Math.max(-1, ...t.steps.filter((s) => !s.deletedAt).map((s) => s.order)) + 1;
        return {
          ...t,
          steps: [...t.steps, createStep(deviceId, trimmed, order)],
          ...touch(deviceId),
        };
      });
    },

    updateStep: (taskId, stepId, patch) => {
      updateTaskWith(taskId, (t, deviceId) => ({
        ...t,
        steps: t.steps.map((s) =>
          s.id === stepId ? { ...s, ...patch, ...touch(deviceId) } : s,
        ),
        ...touch(deviceId),
      }));
    },

    toggleStep: (taskId, stepId) => {
      updateTaskWith(taskId, (t, deviceId) => ({
        ...t,
        steps: t.steps.map((s) =>
          s.id === stepId
            ? { ...s, completed: !s.completed, ...touch(deviceId) }
            : s,
        ),
        ...touch(deviceId),
      }));
    },

    deleteStep: (taskId, stepId) => {
      updateTaskWith(taskId, (t, deviceId) => ({
        ...t,
        steps: t.steps.map((s) =>
          s.id === stepId ? { ...s, deletedAt: nowMs(), ...touch(deviceId) } : s,
        ),
        ...touch(deviceId),
      }));
    },

    reorderSteps: (taskId, ids) => {
      updateTaskWith(taskId, (t, deviceId) => {
        const map = new Map(ids.map((id, index) => [id, index]));
        return {
          ...t,
          steps: t.steps.map((s) =>
            map.has(s.id) ? { ...s, order: map.get(s.id)!, ...touch(deviceId) } : s,
          ),
          ...touch(deviceId),
        };
      });
    },

    addAttachment: async (taskId, srcPath) => {
      const info = await api.attachmentAdd(srcPath);
      updateTaskWith(taskId, (t, deviceId) => ({
        ...t,
        attachments: [
          ...(t.attachments ?? []),
          {
            id: info.id,
            name: info.name,
            size: info.size,
            mime: info.mime,
            relPath: info.relPath,
            updatedAt: nowMs(),
            updatedBy: deviceId,
          },
        ],
        ...touch(deviceId),
      }));
    },

    removeAttachment: (taskId, attachmentId) => {
      updateTaskWith(taskId, (t, deviceId) => ({
        ...t,
        attachments: (t.attachments ?? []).map((a) =>
          a.id === attachmentId
            ? { ...a, deletedAt: nowMs(), ...touch(deviceId) }
            : a,
        ),
        ...touch(deviceId),
      }));
    },

    ensureAttachment: async (relPath) => {
      try {
        if (await api.attachmentExists(relPath)) return true;
      } catch {
        return false;
      }
      const settings = get().db.settings;
      if (!settings.webdavUrl || !settings.webdavUser) return false;
      try {
        const password = (await api.secretGet("webdav-password")) ?? "";
        const base = await remoteBase(settings);
        const b64 = await api.webdavDownloadBinary(
          base + relPath,
          settings.webdavUser,
          password,
        );
        if (!b64) return false;
        await api.attachmentSave(relPath, b64);
        return true;
      } catch {
        return false;
      }
    },

    updateSettings: (patch) => {
      commit((db) => ({ ...db, settings: { ...db.settings, ...patch } }), true);
    },

    setSort: (key, sort) => {
      commit(
        (db) => ({
          ...db,
          settings: {
            ...db.settings,
            sortBy: { ...(db.settings.sortBy ?? {}), [key]: sort },
          },
        }),
        true,
      );
    },

    exportJson: async (path) => {
      await api.exportData(path, JSON.stringify(get().db, null, 2));
    },

    importJson: async (path) => {
      const text = await api.importData(path);
      const parsed = JSON.parse(text) as Partial<DB>;
      if (!parsed || !Array.isArray(parsed.lists) || !Array.isArray(parsed.tasks)) {
        throw new Error("不是有效的 MacroHard Todo 备份文件");
      }
      const merged = mergeDB(get().db, normalizeDb(parsed)).db;
      get().replaceDb(merged);
    },

    exportCsv: async (path) => {
      const db = get().db;
      const listNames = new Map(db.lists.map((l) => [l.id, l.name]));
      const rows = activeTasks(db).map((t) => ({
        列表: listNames.get(t.listId) ?? "",
        标题: t.title,
        备注: t.notes ?? "",
        截止日期: t.dueDate ?? "",
        截止时间: t.dueTime ?? "",
        重要: t.importance === "high" ? "是" : "",
        已完成: t.completed ? "是" : "",
        步骤: t.steps
          .filter((s) => !s.deletedAt)
          .map((s) => `${s.completed ? "[x]" : "[ ]"} ${s.title}`)
          .join(" | "),
      }));
      const csv = Papa.unparse(rows);
      await api.exportData(path, "﻿" + csv);
    },

    importCsv: async (path) => {
      const text = await api.importData(path);
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      });
      if (parsed.errors.length > 0 && parsed.data.length === 0) {
        throw new Error(`CSV 解析失败：${parsed.errors[0].message}`);
      }
      let db = get().db;
      const now = nowMs();
      const lists = [...db.lists];
      const tasks = [...db.tasks];
      const findOrCreateList = (name: string): string => {
        const target = name.trim() || "任务";
        const existing = lists.find((l) => !l.deletedAt && l.name === target);
        if (existing) return existing.id;
        const id = uid("list");
        lists.push({
          id,
          name: target,
          order: activeLists({ ...db, lists }).length,
          createdAt: now,
          updatedAt: now,
          updatedBy: db.deviceId,
        });
        return id;
      };
      for (const row of parsed.data) {
        const title = (row["标题"] ?? row["title"] ?? "").trim();
        if (!title) continue;
        const listId = findOrCreateList(row["列表"] ?? row["list"] ?? "");
        const dueRaw = (row["截止日期"] ?? row["due"] ?? "").trim();
        const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : undefined;
        const dueTimeRaw = (row["截止时间"] ?? "").trim();
        const dueTime = /^\d{2}:\d{2}$/.test(dueTimeRaw) ? dueTimeRaw : undefined;
        const important = ["是", "true", "yes", "1", "high"].includes(
          (row["重要"] ?? "").trim().toLowerCase(),
        );
        const completed = ["是", "true", "yes", "1"].includes(
          (row["已完成"] ?? "").trim().toLowerCase(),
        );
        const steps = (row["步骤"] ?? "")
          .split("|")
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part, index) => {
            const isDone = /^\[x\]/i.test(part);
            const step = createStep(
              db.deviceId,
              part.replace(/^\[[ x]\]\s*/i, ""),
              index,
            );
            step.completed = isDone;
            return step;
          });
        const order =
          Math.max(
            -1,
            ...tasks.filter((t) => t.listId === listId && !t.deletedAt).map((t) => t.order),
          ) + 1;
        const task = createTask(db.deviceId, {
          listId,
          title,
          notes: (row["备注"] ?? "").trim() || undefined,
          dueDate,
          dueTime,
          importance: important ? "high" : "normal",
          completed,
          completedAt: completed ? now : undefined,
          steps,
          order,
        });
        tasks.push(task);
      }
      db = { ...db, lists, tasks };
      get().replaceDb(db);
    },

    syncNow: async () => {
      const db = get().db;
      const s = db.settings;
      if (!s.webdavUrl || !s.webdavUser) {
        set({
          sync: {
            running: false,
            message: null,
            error: "请先在同步设置中填写 WebDAV 地址与用户名",
          },
        });
        return;
      }
      set({ sync: { running: true, message: null, error: null } });
      try {
        const password = (await api.secretGet("webdav-password")) ?? "";
        const passphrase = s.webdavEncrypt
          ? ((await api.secretGet("sync-passphrase")) ?? "")
          : "";
        const cfg: SyncConfig = {
          url: s.webdavUrl,
          user: s.webdavUser,
          password,
          encrypt: Boolean(s.webdavEncrypt),
          passphrase,
        };
        const outcome = await doSync(db, cfg);

        // 附件：把本地已有、尚未上传的文件推上去
        try {
          const base = await remoteBase(s);
          const uploaded: string[] = JSON.parse(
            localStorage.getItem(UPLOADED_KEY) ?? "[]",
          );
          const known = new Set(uploaded);
          const files = new Map<string, string>();
          for (const t of outcome.db.tasks) {
            for (const a of t.attachments ?? []) {
              if (!a.deletedAt) files.set(a.relPath, a.relPath);
            }
          }
          for (const list of outcome.db.lists) {
            if (list.theme?.image?.relPath) {
              files.set(list.theme.image.relPath, list.theme.image.relPath);
            }
          }
          const myDay = outcome.db.shared["mydayTheme"]?.value as
            | ListTheme
            | undefined;
          if (myDay?.image?.relPath) files.set(myDay.image.relPath, myDay.image.relPath);

          for (const relPath of files.keys()) {
            if (known.has(relPath)) continue;
            if (!(await api.attachmentExists(relPath))) continue;
            const b64 = await api.attachmentRead(relPath);
            await api.webdavUploadBinary(
              base + relPath,
              cfg.user,
              cfg.password,
              b64,
            );
            known.add(relPath);
          }
          localStorage.setItem(UPLOADED_KEY, JSON.stringify([...known]));
        } catch {
          /* 附件同步失败不影响主数据 */
        }

        const next: DB = {
          ...outcome.db,
          settings: { ...outcome.db.settings, lastSyncAt: Date.now() },
        };
        get().replaceDb(next);
        set({
          sync: { running: false, message: outcome.message, error: null },
        });
      } catch (err) {
        set({
          sync: { running: false, message: null, error: String(err) },
        });
      }
    },

    replaceDb: (db) => {
      set({ db });
      schedule(db, true);
    },
  };
});
