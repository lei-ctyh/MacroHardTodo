// 名称开头的 emoji 会被当作列表图标：拆出一个字形（grapheme），其余作为显示文本。
// 存储的名称保持原样，只在渲染层拆分。

type SegmenterLike = new (
  locales?: string,
  options?: { granularity: "grapheme" },
) => { segment(input: string): Iterable<{ segment: string }> };

const Segmenter = (Intl as unknown as { Segmenter?: SegmenterLike }).Segmenter;

const EMOJI_START =
  /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u{1F3FB}-\u{1F3FF}])/u;
const KEYCAP_BASE = /^\d?️?⃣$/u;

function firstGrapheme(value: string): string {
  if (Segmenter) {
    const segmenter = new Segmenter("zh", { granularity: "grapheme" });
    for (const part of segmenter.segment(value)) return part.segment;
    return "";
  }
  return Array.from(value)[0] ?? "";
}

/**
 * 拆分名称开头的一个 emoji。
 * - `emoji` 存在时，调用方把它渲染为图标，并显示 `text` 作为名称。
 * - 没有开头 emoji 时只返回 `text`（去掉了首尾空白）。
 */
export function splitLeadingEmoji(input: string): {
  emoji?: string;
  text: string;
} {
  const name = input.trimStart();
  if (!name) return { text: "" };
  const first = firstGrapheme(name);
  if (!first) return { text: name };
  const isEmoji = EMOJI_START.test(first) || KEYCAP_BASE.test(first);
  if (!isEmoji) return { text: name };
  return { emoji: first, text: name.slice(first.length).trimStart() };
}
