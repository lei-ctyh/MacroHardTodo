import { describe, expect, it } from "vitest";
import {
  UNGROUPED_SECTION_KEY,
  listSections,
  moveList,
} from "../src/lib/views";
import type { TaskGroup, TaskList } from "../src/lib/model";

const now = 1_700_000_000_000;

function list(id: string, order: number, groupId?: string): TaskList {
  return {
    id,
    name: id,
    order,
    groupId,
    createdAt: now,
    updatedAt: now,
    updatedBy: "A",
  };
}

function group(id: string, order: number): TaskGroup {
  return {
    id,
    name: id,
    order,
    createdAt: now,
    updatedAt: now,
    updatedBy: "A",
  };
}

describe("listSections", () => {
  it("未分组列表在前，其后按分组顺序排列", () => {
    const sections = listSections(
      [list("l1", 0), list("l2", 1, "g1"), list("l3", 2, "g2"), list("l4", 3, "g2")],
      [group("g1", 0), group("g2", 1)],
    );
    expect(sections.map((s) => s.key)).toEqual([
      UNGROUPED_SECTION_KEY,
      "g1",
      "g2",
    ]);
    expect(sections.map((s) => s.ids)).toEqual([["l1"], ["l2"], ["l3", "l4"]]);
  });

  it("指向已删除或未知分组的列表回到未分组", () => {
    const sections = listSections([list("l1", 0, "missing")], []);
    expect(sections[0].ids).toEqual(["l1"]);
    expect(sections[0].groupId).toBeUndefined();
  });

  it("空分组仍然生成可投放的区块", () => {
    const sections = listSections([list("l1", 0)], [group("g1", 0)]);
    expect(sections.find((s) => s.key === "g1")?.ids).toEqual([]);
  });
});

describe("moveList", () => {
  const base = () =>
    listSections(
      [list("a", 0), list("b", 1), list("c", 2, "g1"), list("d", 3, "g2")],
      [group("g1", 0), group("g2", 1)],
    );

  it("拖到其他分组的列表上时插入到该位置", () => {
    const next = moveList(base(), "a", "d")!;
    expect(next.find((s) => s.key === UNGROUPED_SECTION_KEY)?.ids).toEqual(["b"]);
    expect(next.find((s) => s.key === "g2")?.ids).toEqual(["a", "d"]);
  });

  it("拖到分组标题上时追加到分组末尾", () => {
    const next = moveList(base(), "b", "group:g1")!;
    expect(next.find((s) => s.key === UNGROUPED_SECTION_KEY)?.ids).toEqual([
      "a",
    ]);
    expect(next.find((s) => s.key === "g1")?.ids).toEqual(["c", "b"]);
  });

  it("拖回未分组区域", () => {
    const next = moveList(base(), "c", "group:ungrouped")!;
    expect(next.find((s) => s.key === UNGROUPED_SECTION_KEY)?.ids).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(next.find((s) => s.key === "g1")?.ids).toEqual([]);
  });

  it("同一分组内拖动与 arrayMove 语义一致", () => {
    const sections = listSections(
      [list("a", 0), list("b", 1), list("c", 2)],
      [],
    );
    expect(moveList(sections, "a", "c")![0].ids).toEqual(["b", "c", "a"]);
    expect(moveList(sections, "c", "a")![0].ids).toEqual(["c", "a", "b"]);
  });

  it("找不到目标时返回 null", () => {
    expect(moveList(base(), "a", "nope")).toBeNull();
    expect(moveList(base(), "nope", "a")).toBeNull();
    expect(moveList(base(), "a", "group:missing")).toBeNull();
  });

  it("不修改传入的区块数据", () => {
    const sections = base();
    moveList(sections, "a", "group:g2");
    expect(sections[0].ids).toEqual(["a", "b"]);
  });
});
