import { describe, expect, it } from "vitest";
import {
  changelogUrl,
  entriesSince,
  entriesUpTo,
  isNewerThanSeen,
  markSeen,
  resolveWhatsNewLanguage,
  type WhatsNewEntry,
} from "@/lib/whatsNew";

const item = (text: string) => ({
  type: "fix" as const,
  zh: text,
  "zh-TW": text,
  en: text,
  ja: text,
});

// 新到旧，和 WHATS_NEW_ENTRIES 的顺序一致
const ENTRIES: WhatsNewEntry[] = [
  { version: "4.1.0", items: [item("future")] },
  { version: "1.0.4", items: [item("four")] },
  { version: "1.0.3", items: [] },
  { version: "1.0.2", items: [item("two")] },
  { version: "1.0.1", items: [item("one")] },
];

const versions = (entries: WhatsNewEntry[]) => entries.map((e) => e.version);

describe("entriesSince", () => {
  it("returns versions after the seen one up to the current one, skipping empty ones", () => {
    expect(versions(entriesSince(ENTRIES, "1.0.1", "1.0.4"))).toEqual([
      "1.0.4",
      "1.0.2",
    ]);
  });

  it("shows only the current version when nothing was recorded", () => {
    expect(versions(entriesSince(ENTRIES, undefined, "1.0.2"))).toEqual([
      "1.0.2",
    ]);
    expect(entriesSince(ENTRIES, undefined, "1.0.3")).toEqual([]);
  });

  it("returns nothing on a downgrade", () => {
    expect(entriesSince(ENTRIES, "1.0.4", "1.0.2")).toEqual([]);
  });

  it("treats a prerelease as older than its release", () => {
    expect(versions(entriesSince(ENTRIES, "1.0.2-beta.1", "1.0.2"))).toEqual([
      "1.0.2",
    ]);
  });
});

describe("entriesUpTo", () => {
  it("lists non-empty versions up to the current one", () => {
    expect(versions(entriesUpTo(ENTRIES, "1.0.4"))).toEqual([
      "1.0.4",
      "1.0.2",
      "1.0.1",
    ]);
  });
});

describe("seen version", () => {
  it("only moves forward", () => {
    expect(markSeen(undefined, "1.0.2")).toBe("1.0.2");
    expect(markSeen("1.0.1", "1.0.2")).toBe("1.0.2");
    expect(markSeen("1.0.4", "1.0.2")).toBe("1.0.4");
    expect(markSeen("1.0.1", undefined)).toBe("1.0.1");
  });

  it("is due only when the current version is newer", () => {
    expect(isNewerThanSeen("1.0.2", undefined)).toBe(true);
    expect(isNewerThanSeen("1.0.2", "1.0.1")).toBe(true);
    expect(isNewerThanSeen("1.0.2", "1.0.2")).toBe(false);
    expect(isNewerThanSeen("1.0.2", "1.0.4")).toBe(false);
  });
});

describe("language and links", () => {
  it("falls back to English for unknown languages", () => {
    expect(resolveWhatsNewLanguage("zh-TW")).toBe("zh-TW");
    expect(resolveWhatsNewLanguage("ja")).toBe("ja");
    expect(resolveWhatsNewLanguage("fr")).toBe("en");
  });

  it("links to the website changelog, Traditional Chinese uses the zh pages", () => {
    expect(changelogUrl("en", "1.0.2")).toBe(
      "https://github.com/jzcangshu/cc-switch-classic/releases/tag/v1.0.2",
    );
    expect(changelogUrl("zh-TW")).toBe("https://github.com/jzcangshu/cc-switch-classic/releases");
  });
});
