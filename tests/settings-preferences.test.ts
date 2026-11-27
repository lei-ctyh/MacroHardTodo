import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/api", () => ({
  api: {
    saveDb: vi.fn().mockResolvedValue(undefined),
  },
}));

import {
  DEFAULT_LIST_ID,
  DEFAULT_SETTINGS,
  createDB,
  createTask,
  profileDisplay,
  type DB,
} from "../src/lib/model";
import { todayISO } from "../src/lib/dates";
import {
  completedTasksForView,
  isSmartViewVisible,
  myDaySuggestionGroups,
  myDaySuggestions,
  smartCounts,
  tasksForView,
} from "../src/lib/views";
import { normalizeDb, useStore } from "../src/store/useStore";

describe("normalizeDb settings backward compatibility", () => {
  it("为旧版 todo-data.json 补齐新增默认设置和嵌套 smartListVisibility", () => {
    const legacy = {
      schemaVersion: 1 as const,
      deviceId: "dev_legacy",
      lists: [],
      groups: [],
      tasks: [],
      shared: {},
      settings: {
        theme: "dark" as const,
        autoPurgeCompletedDays: 14,
        reminderEnabled: false,
        startMinimized: false,
        globalShortcutEnabled: true,
        collapsedGroups: [],
      },
    } as unknown as Partial<DB>;

    const db = normalizeDb(legacy);
    expect(db.settings.theme).toBe("dark");
    expect(db.settings.autoPurgeCompletedDays).toBe(14);
    expect(db.settings.reminderEnabled).toBe(false);
    expect(db.settings.addTasksOnTop).toBe(true);
    expect(db.settings.moveStarredToTop).toBe(true);
    expect(db.settings.playCompletionSound).toBe(true);
    expect(db.settings.confirmBeforeDelete).toBe(true);
    expect(db.settings.weekStartsOn).toBe(1);
    expect(db.settings.autoHideEmptySmartLists).toBe(false);
    expect(db.settings.showDueTodayInMyDay).toBe(true);
    expect(db.settings.smartListVisibility).toEqual(
      DEFAULT_SETTINGS.smartListVisibility,
    );
  });

  it("保留部分自定义的 smartListVisibility 并补齐缺失键", () => {
    const partial = {
      ...createDB("dev"),
      settings: {
        ...DEFAULT_SETTINGS,
        weekStartsOn: 0 as const,
        smartListVisibility: { important: false } as DB["settings"]["smartListVisibility"],
      },
    };
    const db = normalizeDb(partial);
    expect(db.settings.weekStartsOn).toBe(0);
    expect(db.settings.smartListVisibility).toEqual({
      important: false,
      planned: true,
      all: true,
      completed: true,
    });
  });
});

describe("addTasksOnTop & moveStarredToTop", () => {
  it("addTasksOnTop=true 时新任务插入列表顶部，false 时追加到底部", () => {
    const db = createDB("dev");
    const first = createTask("dev", {
      listId: DEFAULT_LIST_ID,
      title: "第一条",
      order: 0,
    });
    useStore.setState({ db: { ...db, tasks: [first] } });

    useStore.getState().addTask({ listId: DEFAULT_LIST_ID, title: "顶部新任务" });
    let ordered = tasksForView(useStore.getState().db, {
      type: "list",
      id: DEFAULT_LIST_ID,
    });
    expect(ordered.map((t) => t.title)).toEqual(["顶部新任务", "第一条"]);

    useStore.getState().updateSettings({ addTasksOnTop: false });
    useStore.getState().addTask({ listId: DEFAULT_LIST_ID, title: "底部新任务" });
    ordered = tasksForView(useStore.getState().db, {
      type: "list",
      id: DEFAULT_LIST_ID,
    });
    expect(ordered.map((t) => t.title)).toEqual([
      "顶部新任务",
      "第一条",
      "底部新任务",
    ]);
  });

  it("moveStarredToTop=true 时标星移至顶部，取消标星保持位置；false 时不改顺序", () => {
    const db = createDB("dev");
    const a = createTask("dev", { listId: DEFAULT_LIST_ID, title: "A", order: 0 });
    const b = createTask("dev", { listId: DEFAULT_LIST_ID, title: "B", order: 1 });
    const c = createTask("dev", { listId: DEFAULT_LIST_ID, title: "C", order: 2 });
    useStore.setState({ db: { ...db, tasks: [a, b, c] } });

    useStore.getState().toggleImportance(c.id);
    let ordered = tasksForView(useStore.getState().db, {
      type: "list",
      id: DEFAULT_LIST_ID,
    });
    expect(ordered.map((t) => t.title)).toEqual(["C", "A", "B"]);

    // 取消标星不跳回原位
    useStore.getState().toggleImportance(c.id);
    ordered = tasksForView(useStore.getState().db, {
      type: "list",
      id: DEFAULT_LIST_ID,
    });
    expect(ordered.map((t) => t.title)).toEqual(["C", "A", "B"]);

    // 关闭 moveStarredToTop 后标星不移动顺序
    useStore.getState().updateSettings({ moveStarredToTop: false });
    useStore.getState().toggleImportance(b.id);
    ordered = tasksForView(useStore.getState().db, {
      type: "list",
      id: DEFAULT_LIST_ID,
    });
    expect(ordered.map((t) => t.title)).toEqual(["C", "A", "B"]);
  });
});

describe("confirmDelete", () => {
  it("confirmBeforeDelete=true 时进入确认队列，false 时直接执行", () => {
    const db = createDB("dev");
    useStore.setState({ db, confirm: null });
    const fn = vi.fn();

    useStore.getState().confirmDelete({
      title: "删除任务",
      message: "确认删除？",
      onConfirm: fn,
    });
    expect(fn).not.toHaveBeenCalled();
    expect(useStore.getState().confirm?.title).toBe("删除任务");

    useStore.getState().closeConfirm();
    useStore.getState().updateSettings({ confirmBeforeDelete: false });
    useStore.getState().confirmDelete({
      title: "删除任务",
      message: "确认删除？",
      onConfirm: fn,
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(useStore.getState().confirm).toBeNull();
  });
});

describe("isSmartViewVisible", () => {
  it("遵守单独显隐开关、自动隐藏空列表与当前视图保护", () => {
    const db = createDB("dev");
    const counts = { myday: 0, important: 0, planned: 2, all: 2, completed: 0 };

    expect(isSmartViewVisible(db, "important", counts)).toBe(true);

    const hiddenDb: DB = {
      ...db,
      settings: {
        ...db.settings,
        smartListVisibility: { ...db.settings.smartListVisibility, planned: false },
      },
    };
    expect(isSmartViewVisible(hiddenDb, "planned", counts)).toBe(false);

    const autoHideDb: DB = {
      ...db,
      settings: { ...db.settings, autoHideEmptySmartLists: true },
    };
    expect(isSmartViewVisible(autoHideDb, "important", counts)).toBe(false);
    expect(isSmartViewVisible(autoHideDb, "planned", counts)).toBe(true);
    // 当前正停留在该智能列表时保持可见，避免突兀消失
    expect(
      isSmartViewVisible(autoHideDb, "important", counts, {
        type: "smart",
        id: "important",
      }),
    ).toBe(true);
  });
});

describe("showDueTodayInMyDay", () => {
  it("开启时今天截止的任务自动出现在我的一天且不重复出现在建议中；关闭时仅手动加入显示", () => {
    const today = todayISO();
    const base = createDB("dev");
    const manual = createTask("dev", {
      listId: DEFAULT_LIST_ID,
      title: "手动加入",
      myDay: today,
      order: 0,
    });
    const dueToday = createTask("dev", {
      listId: DEFAULT_LIST_ID,
      title: "今天截止",
      dueDate: today,
      order: 1,
    });
    const dueTodayDone = createTask("dev", {
      listId: DEFAULT_LIST_ID,
      title: "今天截止已完成",
      dueDate: today,
      completed: true,
      completedAt: 100,
      order: 2,
    });

    const onDb: DB = {
      ...base,
      settings: { ...base.settings, showDueTodayInMyDay: true },
      tasks: [manual, dueToday, dueTodayDone],
    };
    expect(
      tasksForView(onDb, { type: "smart", id: "myday" }).map((t) => t.title),
    ).toEqual(["手动加入", "今天截止"]);
    expect(
      completedTasksForView(onDb, { type: "smart", id: "myday" }).map(
        (t) => t.title,
      ),
    ).toEqual(["今天截止已完成"]);
    expect(smartCounts(onDb).myday).toBe(2);
    expect(myDaySuggestions(onDb).map((t) => t.title)).toEqual([]);
    expect(
      myDaySuggestionGroups(onDb).flatMap((g) => g.tasks.map((t) => t.title)),
    ).toEqual([]);

    const offDb: DB = {
      ...base,
      settings: { ...base.settings, showDueTodayInMyDay: false },
      tasks: [manual, dueToday, dueTodayDone],
    };
    expect(
      tasksForView(offDb, { type: "smart", id: "myday" }).map((t) => t.title),
    ).toEqual(["手动加入"]);
    expect(
      completedTasksForView(offDb, { type: "smart", id: "myday" }).map(
        (t) => t.title,
      ),
    ).toEqual([]);
    expect(smartCounts(offDb).myday).toBe(1);
    expect(myDaySuggestions(offDb).map((t) => t.title)).toEqual(["今天截止"]);
  });
});

describe("profileDisplay", () => {
  it("昵称与副标题按 自定义 -> WebDAV 账号 -> 默认/空 逐级回退", () => {
    expect(profileDisplay({})).toEqual({
      name: "MacroHard Todo",
      subtitle: undefined,
    });
    expect(profileDisplay({ webdavUser: "alice@example.com" })).toEqual({
      name: "MacroHard Todo",
      subtitle: "alice@example.com",
    });
    expect(
      profileDisplay({
        profileName: " 张磊 ",
        profileSubtitle: "专注当下",
        webdavUser: "alice@example.com",
      }),
    ).toEqual({
      name: "张磊",
      subtitle: "专注当下",
    });
    expect(
      profileDisplay({
        profileName: "   ",
        profileSubtitle: "   ",
        webdavUser: "alice@example.com",
      }),
    ).toEqual({
      name: "MacroHard Todo",
      subtitle: "alice@example.com",
    });
  });
});
