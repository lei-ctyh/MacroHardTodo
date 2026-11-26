import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/api", () => ({
  api: {
    saveDb: vi.fn().mockResolvedValue(undefined),
  },
}));

import { createDB } from "../src/lib/model";
import { useStore } from "../src/store/useStore";

describe("toggleSection", () => {
  beforeEach(() => {
    useStore.setState({ db: createDB("dev") });
  });

  it("未记录时按视图默认状态切换，并按视图隔离", () => {
    // 我的一天：已完成区默认折叠，首次切换展开（记录空数组）
    useStore.getState().toggleSection("smart:myday", "completed");
    expect(useStore.getState().db.settings.collapsedSections).toEqual({
      "smart:myday": [],
    });

    // 再切换折叠
    useStore.getState().toggleSection("smart:myday", "completed");
    expect(useStore.getState().db.settings.collapsedSections).toEqual({
      "smart:myday": ["completed"],
    });

    // 分组视图默认展开，首次切换即折叠；其他视图不受影响
    useStore.getState().toggleSection("smart:all", "list:list_x");
    expect(useStore.getState().db.settings.collapsedSections).toEqual({
      "smart:myday": ["completed"],
      "smart:all": ["list:list_x"],
    });
  });
});
