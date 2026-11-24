import { describe, expect, it } from "vitest";
import { sortTasks, viewKey } from "../src/lib/views";
import type { Task } from "../src/lib/model";

const base = 1_700_000_000_000;

function task(over: Partial<Task> & { id: string }): Task {
  return {
    listId: "l1",
    title: over.id,
    completed: false,
    createdAt: base,
    updatedAt: base,
    importance: "normal",
    myDay: null,
    steps: [],
    order: 0,
    ...over,
  };
}

describe("viewKey", () => {
  it("区分列表与我的一天等智能视图", () => {
    expect(viewKey({ type: "list", id: "l1" })).toBe("list:l1");
    expect(viewKey({ type: "smart", id: "myday" })).toBe("smart:myday");
  });
});

describe("sortTasks", () => {
  it("我的顺序保持输入顺序并返回新数组", () => {
    const tasks = [task({ id: "b" }), task({ id: "a" }), task({ id: "c" })];
    const sorted = sortTasks(tasks, "manual");
    expect(sorted.map((t) => t.id)).toEqual(["b", "a", "c"]);
    expect(sorted).not.toBe(tasks);
  });

  it("重要：高优先级在前，其余保持原顺序", () => {
    const tasks = [
      task({ id: "a" }),
      task({ id: "b", importance: "high" }),
      task({ id: "c" }),
      task({ id: "d", importance: "high" }),
    ];
    expect(sortTasks(tasks, "importance").map((t) => t.id)).toEqual([
      "b",
      "d",
      "a",
      "c",
    ]);
  });

  it("截止日期：按日期升序，无日期排最后", () => {
    const tasks = [
      task({ id: "none" }),
      task({ id: "late", dueDate: "2026-12-01" }),
      task({ id: "early", dueDate: "2026-11-01" }),
      task({ id: "today", dueDate: "2026-11-24" }),
    ];
    expect(sortTasks(tasks, "due").map((t) => t.id)).toEqual([
      "early",
      "today",
      "late",
      "none",
    ]);
  });

  it("截止日期相同则按时间升序，无时间排最后", () => {
    const tasks = [
      task({ id: "no-time", dueDate: "2026-11-24" }),
      task({ id: "evening", dueDate: "2026-11-24", dueTime: "18:00" }),
      task({ id: "morning", dueDate: "2026-11-24", dueTime: "09:00" }),
    ];
    expect(sortTasks(tasks, "due").map((t) => t.id)).toEqual([
      "morning",
      "evening",
      "no-time",
    ]);
  });

  it("已添加：创建时间早的在前", () => {
    const tasks = [
      task({ id: "new", createdAt: base + 3000 }),
      task({ id: "old", createdAt: base + 1000 }),
      task({ id: "mid", createdAt: base + 2000 }),
    ];
    expect(sortTasks(tasks, "added").map((t) => t.id)).toEqual([
      "old",
      "mid",
      "new",
    ]);
  });

  it("字母顺序：按中文标题排序", () => {
    const tasks = [
      task({ id: "1", title: "香蕉" }),
      task({ id: "2", title: "橙子" }),
      task({ id: "3", title: "苹果" }),
    ];
    expect(sortTasks(tasks, "alpha").map((t) => t.id)).toEqual(["2", "3", "1"]);
  });

  it("字母顺序：数字按数值排序且忽略大小写", () => {
    const tasks = [
      task({ id: "1", title: "任务10" }),
      task({ id: "2", title: "任务2" }),
      task({ id: "3", title: "任务1" }),
    ];
    expect(sortTasks(tasks, "alpha").map((t) => t.id)).toEqual(["3", "2", "1"]);

    const latin = [
      task({ id: "a", title: "banana" }),
      task({ id: "b", title: "Apple" }),
    ];
    expect(sortTasks(latin, "alpha").map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("相同排序键保持原始顺序（稳定）", () => {
    const tasks = [
      task({ id: "first", dueDate: "2026-11-24" }),
      task({ id: "second", dueDate: "2026-11-24" }),
      task({ id: "third", dueDate: "2026-11-24" }),
    ];
    expect(sortTasks(tasks, "due").map((t) => t.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("不修改传入数组", () => {
    const tasks = [task({ id: "b", importance: "high" }), task({ id: "a" })];
    sortTasks(tasks, "importance");
    expect(tasks.map((t) => t.id)).toEqual(["b", "a"]);
  });
});
