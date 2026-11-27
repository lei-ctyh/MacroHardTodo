import { describe, expect, it } from "vitest";
import {
  buildNextTask,
  describeRecurrence,
  nextOccurrence,
  nextOccurrenceOnOrAfter,
} from "../src/lib/recurrence";
import type { Task } from "../src/lib/model";

const now = Date.now();

function task(over: Partial<Task> = {}): Task {
  return {
    id: "t1",
    listId: "l1",
    title: "重复任务",
    completed: false,
    createdAt: now,
    updatedAt: now,
    updatedBy: "A",
    importance: "normal",
    myDay: null,
    steps: [],
    attachments: [],
    order: 0,
    dueDate: "2026-11-23",
    ...over,
  };
}

describe("nextOccurrence", () => {
  it("每天", () => {
    expect(nextOccurrence("2026-11-23", { freq: "daily", interval: 1 })).toBe(
      "2026-11-24",
    );
  });

  it("每 3 天", () => {
    expect(nextOccurrence("2026-11-23", { freq: "daily", interval: 3 })).toBe(
      "2026-11-26",
    );
  });

  it("每周一（从周一开始应跳到下周一）", () => {
    expect(
      nextOccurrence("2026-11-23", {
        freq: "weekly",
        interval: 1,
        byWeekday: [1],
      }),
    ).toBe("2026-11-30");
  });

  it("每两周的周一、周三：同一周内还有周三", () => {
    // 2026-11-23 是周一，同一周内下一个是周三
    expect(
      nextOccurrence("2026-11-23", {
        freq: "weekly",
        interval: 2,
        byWeekday: [1, 3],
      }),
    ).toBe("2026-11-25");
    // 跳过一整周，再到下一个活动周的周一
    expect(
      nextOccurrence("2026-11-25", {
        freq: "weekly",
        interval: 2,
        byWeekday: [1, 3],
      }),
    ).toBe("2026-12-07");
  });

  it("每月 31 日会保留原始日号，遇到短月取月末", () => {
    expect(
      nextOccurrence("2026-01-31", {
        freq: "monthly",
        interval: 1,
        anchorDay: 31,
      }),
    ).toBe("2026-02-28");
    expect(
      nextOccurrence("2026-02-28", {
        freq: "monthly",
        interval: 1,
        anchorDay: 31,
      }),
    ).toBe("2026-03-31");
  });

  it("每年 2 月 29 日在平年落到 2 月 28 日，闰年回到 29 日", () => {
    const rule = { freq: "yearly" as const, interval: 1, anchorMonth: 1, anchorDay: 29 };
    expect(nextOccurrence("2028-02-29", rule)).toBe("2029-02-28");
    expect(nextOccurrence("2029-02-28", rule)).toBe("2030-02-28");
    expect(nextOccurrence("2031-02-28", rule)).toBe("2032-02-29");
  });

  it("每年", () => {
    expect(nextOccurrence("2026-11-23", { freq: "yearly", interval: 1 })).toBe(
      "2027-11-23",
    );
  });

  it("逾期补齐到今天或之后", () => {
    expect(
      nextOccurrenceOnOrAfter(
        "2026-11-08",
        { freq: "daily", interval: 1 },
        "2026-11-26",
      ),
    ).toBe("2026-11-26");
    // 2026-11-26 是周四，每周日的任务下一次是 11/29
    expect(
      nextOccurrenceOnOrAfter(
        "2026-11-01",
        { freq: "weekly", interval: 1, byWeekday: [0] },
        "2026-11-26",
      ),
    ).toBe("2026-11-29");
  });

  it("超过结束日期则停止", () => {
    expect(
      nextOccurrence("2026-11-23", {
        freq: "daily",
        interval: 1,
        endDate: "2026-11-23",
      }),
    ).toBeNull();
  });

  it("达到总次数则停止", () => {
    expect(
      nextOccurrence("2026-11-23", {
        freq: "daily",
        interval: 1,
        totalOccurrences: 2,
        occurrenceIndex: 2,
      }),
    ).toBeNull();
  });
});

describe("buildNextTask", () => {
  it("生成下一次实例并保留系列信息", () => {
    const src = task({
      seriesId: "series1",
      steps: [
        {
          id: "s1",
          title: "步骤",
          completed: true,
          order: 0,
          updatedAt: now,
          updatedBy: "A",
        },
      ],
      recurrence: { freq: "daily", interval: 1, occurrenceIndex: 1 },
      reminderAt: now,
    });
    const next = buildNextTask("B", src, "2026-11-24");
    expect(next.id).not.toBe(src.id);
    expect(next.seriesId).toBe("series1");
    expect(next.occurrenceKey).toBe("series1:2026-11-24");
    expect(next.completed).toBe(false);
    expect(next.dueDate).toBe("2026-11-24");
    expect(next.recurrence?.occurrenceIndex).toBe(2);
    expect(next.steps[0].completed).toBe(false);
    expect(next.steps[0].id).not.toBe("s1");
  });
});

describe("describeRecurrence", () => {
  it("中文描述", () => {
    expect(describeRecurrence({ freq: "daily", interval: 1 })).toBe("每天");
    expect(describeRecurrence({ freq: "weekly", interval: 2 })).toBe("每 2 周");
    expect(
      describeRecurrence({ freq: "weekly", interval: 1, byWeekday: [1, 3] }),
    ).toBe("每周 周一、周三");
  });
});
