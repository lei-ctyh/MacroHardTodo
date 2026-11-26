import { describe, expect, it } from "vitest";
import { splitLeadingEmoji } from "../src/lib/emoji";

describe("splitLeadingEmoji", () => {
  it("keeps plain names unchanged", () => {
    expect(splitLeadingEmoji("工作")).toEqual({ text: "工作" });
    expect(splitLeadingEmoji("  Work  ")).toEqual({ text: "Work  " });
  });

  it("splits a leading emoji from the rest of the name", () => {
    expect(splitLeadingEmoji("😄新建列表")).toEqual({
      emoji: "😄",
      text: "新建列表",
    });
    expect(splitLeadingEmoji("🚀 Launch")).toEqual({
      emoji: "🚀",
      text: "Launch",
    });
  });

  it("ignores leading whitespace before the emoji", () => {
    expect(splitLeadingEmoji("  📚 读书")).toEqual({
      emoji: "📚",
      text: "读书",
    });
  });

  it("treats digits, hashes and letters as normal text", () => {
    expect(splitLeadingEmoji("1 号清单")).toEqual({ text: "1 号清单" });
    expect(splitLeadingEmoji("#标签")).toEqual({ text: "#标签" });
    expect(splitLeadingEmoji("A 计划")).toEqual({ text: "A 计划" });
  });

  it("handles keycap, flag and ZWJ sequences as one emoji", () => {
    expect(splitLeadingEmoji("1️⃣ 第一条")).toEqual({
      emoji: "1️⃣",
      text: "第一条",
    });
    expect(splitLeadingEmoji("🇨🇳 中国")).toEqual({
      emoji: "🇨🇳",
      text: "中国",
    });
    expect(splitLeadingEmoji("👨‍👩‍👧 家庭")).toEqual({
      emoji: "👨‍👩‍👧",
      text: "家庭",
    });
  });

  it("supports skin-tone modifiers", () => {
    expect(splitLeadingEmoji("👍🏽 好")).toEqual({
      emoji: "👍🏽",
      text: "好",
    });
  });

  it("handles an emoji-only name", () => {
    expect(splitLeadingEmoji("🍎")).toEqual({ emoji: "🍎", text: "" });
  });

  it("handles empty input", () => {
    expect(splitLeadingEmoji("")).toEqual({ text: "" });
    expect(splitLeadingEmoji("   ")).toEqual({ text: "" });
  });
});
