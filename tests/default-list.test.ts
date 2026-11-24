import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIST_ID,
  createDB,
  createTask,
  ensureDefaultList,
} from "../src/lib/model";
import { tasksForView } from "../src/lib/views";

describe("default task list", () => {
  it("createDB seeds the fixed 任务 list", () => {
    const db = createDB("dev");
    const list = db.lists.find((l) => l.id === DEFAULT_LIST_ID);
    expect(list?.name).toBe("任务");
    expect(list?.deletedAt).toBeUndefined();
  });

  it("ensureDefaultList adds a missing default list", () => {
    const db = { ...createDB("dev"), lists: [] };
    const next = ensureDefaultList(db);
    expect(next.lists.some((l) => l.id === DEFAULT_LIST_ID)).toBe(true);
  });

  it("ensureDefaultList revives a deleted default list", () => {
    const db = createDB("dev");
    const tombstoned = {
      ...db,
      lists: db.lists.map((l) =>
        l.id === DEFAULT_LIST_ID ? { ...l, deletedAt: 123 } : l,
      ),
    };
    const next = ensureDefaultList(tombstoned);
    expect(
      next.lists.find((l) => l.id === DEFAULT_LIST_ID)?.deletedAt,
    ).toBeUndefined();
  });
});

describe("all smart view", () => {
  it("returns incomplete tasks across lists", () => {
    const db = createDB("dev");
    const a = createTask("dev", { listId: DEFAULT_LIST_ID, title: "a" });
    const b = createTask("dev", {
      listId: DEFAULT_LIST_ID,
      title: "b",
      completed: true,
    });
    const visible = tasksForView(
      { ...db, tasks: [a, b] },
      { type: "smart", id: "all" },
    );
    expect(visible.map((t) => t.title)).toEqual(["a"]);
  });
});
