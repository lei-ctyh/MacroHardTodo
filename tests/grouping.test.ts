import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIST_ID,
  createDB,
  createTask,
  type DB,
  type Task,
  type TaskGroup,
  type TaskList,
} from "../src/lib/model";
import { addDaysISO, isoToDate, todayISO } from "../src/lib/dates";
import {
  completedTasksForView,
  defaultCollapsedSections,
  plannedBucketKey,
  plannedRangeTitle,
  searchTasks,
  sectionsForView,
  tasksForView,
  type View,
} from "../src/lib/views";

const now = 1_700_000_000_000;

function list(
  id: string,
  order: number,
  extra: Partial<TaskList> = {},
): TaskList {
  return {
    id,
    name: id,
    order,
    createdAt: now,
    updatedAt: now,
    updatedBy: "dev",
    ...extra,
  };
}

function group(id: string, order: number): TaskGroup {
  return {
    id,
    name: id,
    order,
    createdAt: now,
    updatedAt: now,
    updatedBy: "dev",
  };
}

function task(over: Partial<Task> & { listId: string; title: string }): Task {
  return createTask("dev", over);
}

const planned: View = { type: "smart", id: "planned" };
const allView: View = { type: "smart", id: "all" };
const completedView: View = { type: "smart", id: "completed" };

describe("defaultCollapsedSections", () => {
  it("平铺视图的已完成区默认折叠，分组视图默认展开", () => {
    expect(defaultCollapsedSections(`list:${DEFAULT_LIST_ID}`)).toEqual([
      "completed",
    ]);
    expect(defaultCollapsedSections("smart:myday")).toEqual(["completed"]);
    expect(defaultCollapsedSections("smart:important")).toEqual(["completed"]);
    expect(defaultCollapsedSections("smart:planned")).toEqual([]);
    expect(defaultCollapsedSections("smart:all")).toEqual([]);
    expect(defaultCollapsedSections("smart:completed")).toEqual([]);
  });
});

describe("plannedBucketKey", () => {
  const today = "2026-11-26";
  const tomorrow = "2026-11-27";
  const next5End = "2026-12-02";

  const bucket = (over: Partial<Task>) =>
    plannedBucketKey(
      task({ listId: DEFAULT_LIST_ID, title: "t", ...over }),
      today,
      tomorrow,
      next5End,
    );

  it("按日期边界划分五个桶（逾期按日期比较）", () => {
    expect(bucket({ dueDate: "2026-11-25" })).toBe("overdue");
    expect(bucket({ dueDate: today })).toBe("today");
    expect(bucket({ dueDate: tomorrow })).toBe("tomorrow");
    expect(bucket({ dueDate: "2026-11-28" })).toBe("next5");
    expect(bucket({ dueDate: next5End })).toBe("next5");
    expect(bucket({ dueDate: "2026-12-03" })).toBe("later");
  });

  it("今天已过截止时间仍归入今天", () => {
    expect(bucket({ dueDate: today, dueTime: "00:01" })).toBe("today");
  });

  it("只有提醒时间时使用提醒日期", () => {
    const noon = new Date(2026, 10, 26, 9, 0).getTime();
    expect(bucket({ reminderAt: noon })).toBe("today");
  });

  it("截止日期优先于提醒时间", () => {
    const weekday = new Date(2026, 10, 28, 9, 0).getTime();
    expect(bucket({ dueDate: today, reminderAt: weekday })).toBe("today");
  });
});

describe("plannedRangeTitle", () => {
  it("输出 M月d日,周X到M月d日,周X", () => {
    expect(
      plannedRangeTitle(new Date(2026, 10, 28), new Date(2026, 11, 2)),
    ).toBe("11月28日,周六到12月2日,周三");
  });
});

describe("sectionsForView: 计划内", () => {
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);

  it("按日期桶分组，只包含未完成任务（不把历史已完成任务算入已逾期）", () => {
    const db: DB = {
      ...createDB("dev"),
      tasks: [
        task({ listId: DEFAULT_LIST_ID, title: "逾期", dueDate: addDaysISO(today, -1) }),
        task({
          listId: DEFAULT_LIST_ID,
          title: "历史已完成",
          dueDate: addDaysISO(today, -5),
          completed: true,
          completedAt: 1,
        }),
        task({ listId: DEFAULT_LIST_ID, title: "今天", dueDate: today, order: 0 }),
        task({
          listId: DEFAULT_LIST_ID,
          title: "今天已完成",
          dueDate: today,
          order: 1,
          completed: true,
          completedAt: 2,
        }),
        task({
          listId: DEFAULT_LIST_ID,
          title: "明天",
          dueDate: tomorrow,
          reminderAt: isoToDate(tomorrow).getTime(),
        }),
        task({ listId: DEFAULT_LIST_ID, title: "第2天", dueDate: addDaysISO(today, 2) }),
        task({ listId: DEFAULT_LIST_ID, title: "第6天", dueDate: addDaysISO(today, 6) }),
        task({ listId: DEFAULT_LIST_ID, title: "第7天", dueDate: addDaysISO(today, 7) }),
      ],
    };
    const sections = sectionsForView(
      db,
      planned,
      tasksForView(db, planned),
    );

    expect(sections.map((s) => s.key)).toEqual([
      "overdue",
      "today",
      "tomorrow",
      "next5",
      "later",
    ]);
    expect(sections.find((s) => s.key === "overdue")!.tasks.map((t) => t.title)).toEqual([
      "逾期",
    ]);
    expect(sections.find((s) => s.key === "today")!.tasks.map((t) => t.title)).toEqual([
      "今天",
    ]);
    expect(sections.find((s) => s.key === "next5")!.tasks.map((t) => t.title)).toEqual([
      "第2天",
      "第6天",
    ]);
    expect(sections.find((s) => s.key === "later")!.tasks.map((t) => t.title)).toEqual([
      "第7天",
    ]);
  });

  it("空桶不渲染，标题显示数量所需的任务数", () => {
    const db: DB = {
      ...createDB("dev"),
      tasks: [
        task({ listId: DEFAULT_LIST_ID, title: "a", dueDate: today }),
        task({ listId: DEFAULT_LIST_ID, title: "b", dueDate: today }),
      ],
    };
    const sections = sectionsForView(db, planned, tasksForView(db, planned));
    expect(sections.map((s) => s.key)).toEqual(["today"]);
    expect(sections[0].tasks).toHaveLength(2);
  });

  it("组内按当前视图排序（重要优先）", () => {
    const db: DB = {
      ...createDB("dev"),
      settings: {
        ...createDB("dev").settings,
        sortBy: { "smart:planned": "importance" },
      },
      tasks: [
        task({ listId: DEFAULT_LIST_ID, title: "普通", dueDate: today, order: 0 }),
        task({
          listId: DEFAULT_LIST_ID,
          title: "重要",
          dueDate: today,
          order: 1,
          importance: "high",
        }),
      ],
    };
    const sections = sectionsForView(db, planned, tasksForView(db, planned));
    expect(sections[0].tasks.map((t) => t.title)).toEqual(["重要", "普通"]);
  });
});

describe("sectionsForView: 全部", () => {
  function fixture(): DB {
    const db = createDB("dev");
    return {
      ...db,
      lists: [
        ...db.lists,
        list("list_emoji", 1, { name: "😊222" }),
        list("list_g", 2, { name: "组内列表", groupId: "g1" }),
        list("list_empty", 3, { name: "空列表" }),
      ],
      groups: [group("g1", 0)],
      tasks: [
        task({ listId: DEFAULT_LIST_ID, title: "默认", order: 0 }),
        task({ listId: "list_emoji", title: "表情", order: 0 }),
        task({ listId: "list_g", title: "组内", order: 0 }),
        task({ listId: "list_emoji", title: "已完成", completed: true, completedAt: 1 }),
        task({ listId: "missing", title: "孤儿" }),
      ],
    };
  }

  it("按侧栏顺序分组，标题保留原始名称，跳过未知列表", () => {
    const db = fixture();
    const sections = sectionsForView(db, allView, tasksForView(db, allView));
    expect(sections.map((s) => s.key)).toEqual([
      `list:${DEFAULT_LIST_ID}`,
      "list:list_emoji",
      "list:list_g",
    ]);
    expect(sections.map((s) => s.title)).toEqual(["任务", "😊222", "组内列表"]);
    expect(sections.map((s) => s.tasks.map((t) => t.title))).toEqual([
      ["默认"],
      ["表情"],
      ["组内"],
    ]);
  });

  it("搜索后按命中结果重建分组，空分组不返回", () => {
    const db = fixture();
    const visible = searchTasks(tasksForView(db, allView), "表情");
    const sections = sectionsForView(db, allView, visible);
    expect(sections.map((s) => s.key)).toEqual(["list:list_emoji"]);
    expect(sections[0].tasks.map((t) => t.title)).toEqual(["表情"]);
  });

  it("组内按视图排序（字母顺序）", () => {
    const db: DB = {
      ...createDB("dev"),
      settings: {
        ...createDB("dev").settings,
        sortBy: { "smart:all": "alpha" },
      },
      tasks: [
        task({ listId: DEFAULT_LIST_ID, title: "橘子", order: 0 }),
        task({ listId: DEFAULT_LIST_ID, title: "苹果", order: 1 }),
      ],
    };
    const sections = sectionsForView(db, allView, tasksForView(db, allView));
    expect(sections[0].tasks.map((t) => t.title)).toEqual(["橘子", "苹果"]);
  });
});

describe("sectionsForView: 已完成", () => {
  function fixture(): DB {
    const db = createDB("dev");
    return {
      ...db,
      lists: [
        ...db.lists,
        list("list_emoji", 1, { name: "😊222" }),
        list("list_g", 2, { name: "组内列表", groupId: "g1" }),
      ],
      groups: [group("g1", 0)],
      tasks: [
        task({
          listId: DEFAULT_LIST_ID,
          title: "早完成",
          completed: true,
          completedAt: 10,
        }),
        task({
          listId: DEFAULT_LIST_ID,
          title: "晚完成",
          completed: true,
          completedAt: 30,
        }),
        task({
          listId: "list_emoji",
          title: "表情完成",
          completed: true,
          completedAt: 20,
        }),
        task({ listId: "list_emoji", title: "未完成" }),
        task({
          listId: "missing",
          title: "孤儿完成",
          completed: true,
          completedAt: 40,
        }),
      ],
    };
  }

  it("按侧栏顺序分组，组内完成时间倒序", () => {
    const db = fixture();
    const sections = sectionsForView(
      db,
      completedView,
      tasksForView(db, completedView),
    );
    expect(sections.map((s) => s.key)).toEqual([
      `list:${DEFAULT_LIST_ID}`,
      "list:list_emoji",
    ]);
    expect(sections.map((s) => s.title)).toEqual(["任务", "😊222"]);
    expect(sections[0].tasks.map((t) => t.title)).toEqual(["晚完成", "早完成"]);
    expect(sections[1].tasks.map((t) => t.title)).toEqual(["表情完成"]);
  });

  it("平铺视图不返回分组", () => {
    const db = fixture();
    expect(sectionsForView(db, { type: "smart", id: "myday" }, [])).toEqual([]);
    expect(
      sectionsForView(db, { type: "list", id: DEFAULT_LIST_ID }, []),
    ).toEqual([]);
  });
});

describe("completedTasksForView", () => {
  const today = todayISO();

  function fixture(): DB {
    const db = createDB("dev");
    return {
      ...db,
      lists: [...db.lists, list("list_x", 1)],
      tasks: [
        task({
          listId: DEFAULT_LIST_ID,
          title: "列表完成早",
          completed: true,
          completedAt: 10,
        }),
        task({
          listId: DEFAULT_LIST_ID,
          title: "列表完成晚",
          completed: true,
          completedAt: 20,
        }),
        task({ listId: DEFAULT_LIST_ID, title: "未完成" }),
        task({
          listId: "list_x",
          title: "我的一天完成",
          completed: true,
          completedAt: 5,
          myDay: today,
        }),
        task({
          listId: "list_x",
          title: "重要完成",
          completed: true,
          completedAt: 6,
          importance: "high",
        }),
        task({
          listId: "list_x",
          title: "普通完成",
          completed: true,
          completedAt: 7,
        }),
      ],
    };
  }

  it("列表视图返回该列表全部已完成任务，完成时间倒序", () => {
    const db = fixture();
    const done = completedTasksForView(db, {
      type: "list",
      id: DEFAULT_LIST_ID,
    });
    expect(done.map((t) => t.title)).toEqual(["列表完成晚", "列表完成早"]);
  });

  it("我的一天只统计今天加入且已完成的任务", () => {
    const db = fixture();
    const done = completedTasksForView(db, { type: "smart", id: "myday" });
    expect(done.map((t) => t.title)).toEqual(["我的一天完成"]);
  });

  it("重要只统计重要且已完成的任务", () => {
    const db = fixture();
    const done = completedTasksForView(db, { type: "smart", id: "important" });
    expect(done.map((t) => t.title)).toEqual(["重要完成"]);
  });

  it("计划内 / 全部 / 已完成没有底部已完成区", () => {
    const db = fixture();
    expect(completedTasksForView(db, planned)).toEqual([]);
    expect(completedTasksForView(db, allView)).toEqual([]);
    expect(completedTasksForView(db, completedView)).toEqual([]);
  });
});
