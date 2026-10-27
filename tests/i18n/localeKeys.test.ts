import { describe, expect, it } from "vitest";
import en from "@/i18n/locales/en.json";
import ja from "@/i18n/locales/ja.json";
import zhTW from "@/i18n/locales/zh-TW.json";
import zh from "@/i18n/locales/zh.json";
import { APP_IDS } from "@/config/appConfig";
import { TOOL_NAMES } from "@/components/apps/useToolManagement";
import { KNOWN_APP_TYPES } from "@/types/usage";

const LOCALES = { zh, en, ja, "zh-TW": zhTW } as const;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function flatten(value: Json, prefix = "", out: Record<string, Json> = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    out[prefix] = value;
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

const FLAT = Object.fromEntries(
  Object.entries(LOCALES).map(([locale, messages]) => [
    locale,
    flatten(messages as Json),
  ]),
) as Record<keyof typeof LOCALES, Record<string, Json>>;

/** 代码里按名字拼出来的 key（应用名、安装提示、用量页文案）必须四份都在。 */
const REQUIRED_KEYS = [
  ...APP_IDS.map((app) => `apps.${app}`),
  ...TOOL_NAMES.map((tool) => `appsPage.installHint.${tool}`),
  ...KNOWN_APP_TYPES.map((app) => `usage.appFilter.${app}`),
  "usage.syncStatus.auto",
  "usage.syncStatus.off",
  "usage.syncStatus.tipAuto",
  "usage.refreshMenu.seconds",
  "usage.display.logColumnsSummary",
  "usage.tabs.settings",
  "usage.sortedByRequests",
  "usage.trend.styleLabel",
  "usage.trend.styleNew",
  "usage.trend.styleOld",
  "settings.officialWebsite",
  "settings.starOnGithub",
];

describe("locale catalogs", () => {
  it.each(Object.keys(LOCALES))("%s has every required key", (locale) => {
    const messages = FLAT[locale as keyof typeof LOCALES];
    const missing = REQUIRED_KEYS.filter((key) => !(key in messages));
    expect(missing).toEqual([]);
  });

  it("keeps the four catalogs on the same key set", () => {
    const [base, ...others] = Object.keys(LOCALES) as Array<
      keyof typeof LOCALES
    >;
    const baseKeys = Object.keys(FLAT[base]).sort();
    for (const locale of others) {
      expect(Object.keys(FLAT[locale]).sort()).toEqual(baseKeys);
    }
  });
});
