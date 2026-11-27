import { describe, expect, it } from "vitest";
import { resolveDataUrl, resolveTestUrl } from "../src/lib/syncClient";

describe("WebDAV URL resolution", () => {
  it("resolveDataUrl appends MacroHardTodo/data.json for folders and preserves .json paths", () => {
    expect(resolveDataUrl("https://dav.jianguoyun.com/dav/todo")).toBe(
      "https://dav.jianguoyun.com/dav/todo/MacroHardTodo/data.json",
    );
    expect(resolveDataUrl("https://dav.jianguoyun.com/dav/todo/")).toBe(
      "https://dav.jianguoyun.com/dav/todo/MacroHardTodo/data.json",
    );
    expect(
      resolveDataUrl("https://dav.jianguoyun.com/dav/todo/custom.json"),
    ).toBe("https://dav.jianguoyun.com/dav/todo/custom.json");
  });

  it("resolveTestUrl targets the configured folder (or parent of .json) to avoid 409 on missing subfolder", () => {
    expect(resolveTestUrl("https://dav.jianguoyun.com/dav/todo")).toBe(
      "https://dav.jianguoyun.com/dav/todo/",
    );
    expect(resolveTestUrl("https://dav.jianguoyun.com/dav/todo/")).toBe(
      "https://dav.jianguoyun.com/dav/todo/",
    );
    expect(
      resolveTestUrl("https://dav.jianguoyun.com/dav/todo/custom.json"),
    ).toBe("https://dav.jianguoyun.com/dav/todo/");
  });
});
