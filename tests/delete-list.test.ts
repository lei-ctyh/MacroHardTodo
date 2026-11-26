import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/api", () => ({
  api: {
    saveDb: vi.fn().mockResolvedValue(undefined),
  },
}));

import { DEFAULT_LIST_ID, createDB, createTask } from "../src/lib/model";
import { useStore } from "../src/store/useStore";

describe("deleteList", () => {
  it("把该列表全部任务（含已完成）追加到默认列表末尾并软删除列表", () => {
    const db = createDB("dev");
    const temp = {
      id: "list_x",
      name: "临时列表",
      order: 1,
      createdAt: 1,
      updatedAt: 1,
      updatedBy: "dev",
    };
    const tasks = [
      createTask("dev", { listId: DEFAULT_LIST_ID, title: "默认一", order: 0 }),
      createTask("dev", {
        listId: DEFAULT_LIST_ID,
        title: "默认二",
        order: 1,
        completed: true,
        completedAt: 5,
      }),
      createTask("dev", { listId: "list_x", title: "待移动一", order: 0 }),
      createTask("dev", {
        listId: "list_x",
        title: "待移动二",
        order: 1,
        completed: true,
        completedAt: 7,
        myDay: "2026-11-26",
      }),
    ];
    useStore.setState({
      db: { ...db, lists: [...db.lists, temp], tasks },
      view: { type: "list", id: "list_x" },
    });

    useStore.getState().deleteList("list_x");

    const next = useStore.getState().db;
    const moved = next.tasks
      .filter((t) => t.listId === DEFAULT_LIST_ID)
      .sort((a, b) => a.order - b.order);
    expect(moved.map((t) => t.title)).toEqual([
      "默认一",
      "默认二",
      "待移动一",
      "待移动二",
    ]);
    expect(moved.map((t) => t.order)).toEqual([0, 1, 2, 3]);

    const movedCompleted = moved.find((t) => t.title === "待移动二")!;
    expect(movedCompleted.completed).toBe(true);
    expect(movedCompleted.completedAt).toBe(7);
    expect(movedCompleted.myDay).toBe("2026-11-26");

    expect(next.lists.find((l) => l.id === "list_x")!.deletedAt).toBeDefined();
    expect(useStore.getState().view).toEqual({
      type: "list",
      id: DEFAULT_LIST_ID,
    });
  });

  it("跳过已删除任务，不移动它们", () => {
    const db = createDB("dev");
    const temp = {
      id: "list_x",
      name: "临时列表",
      order: 1,
      createdAt: 1,
      updatedAt: 1,
      updatedBy: "dev",
    };
    const alive = createTask("dev", { listId: "list_x", title: "保留", order: 0 });
    const gone = {
      ...createTask("dev", { listId: "list_x", title: "已删除", order: 1 }),
      deletedAt: 3,
    };
    useStore.setState({
      db: { ...db, lists: [...db.lists, temp], tasks: [alive, gone] },
      view: { type: "smart", id: "myday" },
    });

    useStore.getState().deleteList("list_x");

    const next = useStore.getState().db;
    expect(next.tasks.find((t) => t.title === "保留")!.listId).toBe(
      DEFAULT_LIST_ID,
    );
    const still = next.tasks.find((t) => t.title === "已删除")!;
    expect(still.listId).toBe("list_x");
    expect(still.deletedAt).toBe(3);
  });

  it("默认列表不可删除", () => {
    const db = createDB("dev");
    useStore.setState({ db });
    useStore.getState().deleteList(DEFAULT_LIST_ID);
    expect(
      useStore.getState().db.lists.find((l) => l.id === DEFAULT_LIST_ID)!
        .deletedAt,
    ).toBeUndefined();
  });
});
