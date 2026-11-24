import { describe, expect, it } from "vitest";
import { mergeDB, fingerprint } from "../src/lib/merge";
import { DEFAULT_SETTINGS, type DB, type Task } from "../src/lib/model";

const now = Date.now();

function task(over: Partial<Task>): Task {
  return {
    id: "t1",
    listId: "l1",
    title: "任务",
    completed: false,
    createdAt: now - 5000,
    updatedAt: now - 4000,
    updatedBy: "A",
    importance: "normal",
    myDay: null,
    steps: [],
    attachments: [],
    order: 0,
    ...over,
  };
}

function db(deviceId: string, tasks: Task[]): DB {
  return {
    schemaVersion: 1,
    deviceId,
    lists: [
      {
        id: "l1",
        name: "任务",
        order: 0,
        createdAt: now - 5000,
        updatedAt: now - 5000,
        updatedBy: deviceId,
      },
    ],
    tasks,
    shared: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

describe("mergeDB", () => {
  it("同一任务按 updatedAt 取较新者", () => {
    const local = db("A", [task({ title: "本地", updatedAt: now - 1000 })]);
    const remote = db("B", [task({ title: "远端", updatedAt: now, updatedBy: "B" })]);
    const { db: merged, changed } = mergeDB(local, remote);
    expect(merged.tasks[0].title).toBe("远端");
    expect(changed).toBe(true);
  });

  it("updatedAt 相同时按 deviceId 决胜", () => {
    const local = db("A", [task({ title: "本地", updatedAt: now })]);
    const remote = db("B", [task({ title: "远端", updatedAt: now, updatedBy: "B" })]);
    expect(mergeDB(local, remote).db.tasks[0].title).toBe("远端");
  });

  it("删除墓碑不会被旧数据复活", () => {
    const local = db("A", [task({ updatedAt: now - 1000 })]);
    const remote = db("B", [
      task({ updatedAt: now, updatedBy: "B", deletedAt: now }),
    ]);
    const merged = mergeDB(local, remote).db;
    expect(merged.tasks[0].deletedAt).toBeTruthy();
  });

  it("两端分别修改步骤时步骤会合并", () => {
    const local = db("A", [
      task({
        steps: [
          {
            id: "s1",
            title: "甲",
            completed: false,
            order: 0,
            updatedAt: now - 2000,
            updatedBy: "A",
          },
        ],
      }),
    ]);
    const remote = db("B", [
      task({
        steps: [
          {
            id: "s1",
            title: "甲",
            completed: true,
            order: 0,
            updatedAt: now - 1000,
            updatedBy: "B",
          },
          {
            id: "s2",
            title: "乙",
            completed: false,
            order: 1,
            updatedAt: now - 500,
            updatedBy: "B",
          },
        ],
      }),
    ]);
    const merged = mergeDB(local, remote).db;
    const steps = merged.tasks[0].steps;
    expect(steps).toHaveLength(2);
    expect(steps.find((s) => s.id === "s1")?.completed).toBe(true);
  });

  it("重复任务实例按 occurrenceKey 去重", () => {
    const local = db("A", [
      task({ id: "t1", occurrenceKey: "series:2026-11-24", updatedAt: now - 1000 }),
    ]);
    const remote = db("B", [
      task({
        id: "t2",
        occurrenceKey: "series:2026-11-24",
        updatedAt: now,
        updatedBy: "B",
      }),
    ]);
    const merged = mergeDB(local, remote).db;
    expect(merged.tasks).toHaveLength(1);
    expect(merged.tasks[0].id).toBe("t2");
  });

  it("同步设置按 key 合并，本地界面设置不被覆盖", () => {
    const local = db("A", []);
    local.shared = { theme: { value: "light", updatedAt: now, updatedBy: "A" } };
    local.settings.theme = "dark";
    const remote = db("B", []);
    remote.shared = { theme: { value: "light", updatedAt: now - 1000, updatedBy: "B" } };
    remote.settings.theme = "light";
    const merged = mergeDB(local, remote).db;
    expect(merged.settings.theme).toBe("dark");
    expect(merged.shared.theme.value).toBe("light");
  });

  it("指纹只与内容有关，与数组顺序无关", () => {
    const a = db("A", [task({ id: "t1" }), task({ id: "t2" })]);
    const b = db("A", [task({ id: "t2" }), task({ id: "t1" })]);
    expect(fingerprint(a)).toBe(fingerprint(b));
  });
});
