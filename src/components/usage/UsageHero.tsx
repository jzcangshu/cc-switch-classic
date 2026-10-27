import { cloneElement, isValidElement } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useUsageSummaryByApp } from "@/lib/query/usage";
import { HelpTip } from "@/components/ui/help-tip";
import { cn } from "@/lib/utils";
import { APP_ICON_MAP } from "@/config/appConfig";
import type { AppId } from "@/lib/api/types";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Database,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  fmtInt,
  formatHitRatePercent,
  formatTokensCompact,
  getLocaleFromLanguage,
  getResolvedLang,
  parseFiniteNumber,
} from "./format";
import {
  getCacheWriteAvailability,
  type AppType,
  type UsageRangeSelection,
  type UsageSummary,
  type UsageSummaryByApp,
} from "@/types/usage";
import { useMoneyFormat } from "@/hooks/useMoneyFormat";

interface UsageHeroProps {
  range: UsageRangeSelection;
  appType?: string;
  providerName?: string;
  model?: string;
  refreshIntervalMs: number;
  /** 窄容器下指标卡排成两列 */
  compact?: boolean;
}

interface TitleTheme {
  /** Foreground color for the icon glyph (text-* class). */
  accent: string;
  /** Background tint for the icon square (bg-* class). */
  iconBg: string;
}

const TITLE_THEMES: Record<AppType | "all", TitleTheme> = {
  all: { accent: "text-primary", iconBg: "bg-primary/10" },
  claude: {
    accent: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-500/10",
  },
  codex: {
    accent: "text-neutral-700 dark:text-neutral-300",
    iconBg: "bg-neutral-500/10",
  },
  gemini: {
    accent: "text-sky-600 dark:text-sky-400",
    iconBg: "bg-sky-500/10",
  },
  grokbuild: {
    accent: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-500/10",
  },
  opencode: {
    accent: "text-purple-600 dark:text-purple-400",
    iconBg: "bg-purple-500/10",
  },
  mcode: {
    accent: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-500/10",
  },
  pi: {
    accent: "text-fuchsia-600 dark:text-fuchsia-400",
    iconBg: "bg-fuchsia-500/10",
  },
  kimi: {
    accent: "text-teal-600 dark:text-teal-400",
    iconBg: "bg-teal-500/10",
  },
  agy: {
    accent: "text-indigo-600 dark:text-indigo-400",
    iconBg: "bg-indigo-500/10",
  },
  omp: {
    accent: "text-lime-600 dark:text-lime-400",
    iconBg: "bg-lime-500/10",
  },
};

/**
 * Combine per-app summaries into a single rolled-up summary.
 *
 * The backend's per-app rows already use fresh-input semantics (cache-inclusive
 * providers have been normalized in SQL), so plain addition is correct here.
 * `cacheHitRate` and `successRate` must be re-derived from the summed counts
 * rather than averaged across rows.
 */
export function aggregateSummaries(items: UsageSummary[]): UsageSummary {
  let totalRequests = 0;
  let successCount = 0;
  let totalCostNum = 0;
  let input = 0;
  let output = 0;
  let cacheCreation = 0;
  let cacheRead = 0;

  for (const s of items) {
    totalRequests += s.totalRequests;
    successCount += Math.round((s.totalRequests * s.successRate) / 100);
    totalCostNum += parseFiniteNumber(s.totalCost) ?? 0;
    input += s.totalInputTokens;
    output += s.totalOutputTokens;
    cacheCreation += s.totalCacheCreationTokens;
    cacheRead += s.totalCacheReadTokens;
  }

  const cacheableInput = input + cacheCreation + cacheRead;
  return {
    totalRequests,
    totalCost: totalCostNum.toFixed(6),
    totalInputTokens: input,
    totalOutputTokens: output,
    totalCacheCreationTokens: cacheCreation,
    totalCacheReadTokens: cacheRead,
    successRate: totalRequests > 0 ? (successCount / totalRequests) * 100 : 0,
    realTotalTokens: input + output + cacheCreation + cacheRead,
    cacheHitRate: cacheableInput > 0 ? cacheRead / cacheableInput : 0,
  };
}

function pickSummary(
  apps: UsageSummaryByApp[],
  appType: string | undefined,
): UsageSummary | undefined {
  if (apps.length === 0) return undefined;
  if (appType) {
    return apps.find((a) => a.appType === appType)?.summary;
  }
  return aggregateSummaries(apps.map((a) => a.summary));
}

/**
 * 汇总卡标题图标：选中具体应用时显示该应用的品牌图标，"全部"时回退到通用闪电。
 * 复用 APP_ICON_MAP（与侧栏 / 应用切换器同一套图标），用 cloneElement 放大到
 * 20px；品牌图标自带配色，外层方块仍按 titleTheme 主题色着色。
 */
function AppGlyphIcon({
  appType,
  accentClass,
}: {
  appType?: string;
  accentClass: string;
}) {
  if (appType && appType in APP_ICON_MAP) {
    const base = APP_ICON_MAP[appType as AppId].icon;
    if (isValidElement<{ size?: number }>(base)) {
      return cloneElement(base, { size: 20 });
    }
  }
  return <Zap className={cn("h-5 w-5", accentClass)} />;
}

/**
 * 汇总区（第三版玻璃卡版式）：品牌图标 + 真实消耗 Tokens 大数与短数徽章、
 * 请求数/成本胶囊，下方彩色小卡与动画命中率条。
 * 保留第四版成功率指标、币种换算与口径悬停说明。
 */
export function UsageHero({
  range,
  appType,
  providerName,
  model,
  refreshIntervalMs,
  compact = false,
}: UsageHeroProps) {
  const { t, i18n } = useTranslation();
  const { money, moneyTitle } = useMoneyFormat();
  const locale = getLocaleFromLanguage(getResolvedLang(i18n));

  const { data, isLoading } = useUsageSummaryByApp(
    range,
    { providerName, model },
    {
      refetchInterval: refreshIntervalMs > 0 ? refreshIntervalMs : false,
    },
  );

  // No client-side filtering: totals must match the Trend/Logs/Stats below,
  // which all go through the backend's full set of app_types. The
  // KNOWN_APP_TYPES list only governs which filter chips appear.
  const allApps = data ?? [];
  const summary = pickSummary(allApps, appType);

  const titleTheme =
    TITLE_THEMES[(appType ?? "all") as keyof typeof TITLE_THEMES] ??
    TITLE_THEMES.all;
  const appLabel =
    appType && appType in TITLE_THEMES ? t(`usage.appFilter.${appType}`) : null;

  const cacheWriteState = getCacheWriteAvailability(
    appType ? [appType] : allApps.map((a) => a.appType),
  );

  const input = summary?.totalInputTokens ?? 0;
  const output = summary?.totalOutputTokens ?? 0;
  const cacheWrite = summary?.totalCacheCreationTokens ?? 0;
  const cacheRead = summary?.totalCacheReadTokens ?? 0;
  const realTotal = summary?.realTotalTokens ?? 0;
  const hitRateDenominator = input + cacheWrite + cacheRead;
  const hitRateKnown = hitRateDenominator > 0;
  const hitRate = summary?.cacheHitRate ?? 0;
  const requests = summary?.totalRequests ?? 0;
  // 加载完但一条请求都没有：所有数值都写「—」（命中率分母为 0 同样「—」）
  const placeholder = isLoading ? "…" : requests === 0 ? "—" : undefined;
  const totalCost = parseFiniteNumber(summary?.totalCost);
  const successRate = summary?.successRate ?? 0;

  if (isLoading) {
    return (
      <section
        aria-label={t("usage.metrics.label")}
        className="flex min-h-[200px] items-center justify-center rounded-xl glass-card"
      >
        <Loader2 className="h-6 w-6 animate-spin text-fg-3" />
      </section>
    );
  }

  const cacheWriteValue =
    cacheWriteState === "na" ? "N/A" : formatTokensCompact(cacheWrite, locale);
  const cacheWriteHelp =
    cacheWriteState === "na"
      ? t("usage.cacheWriteNotReported")
      : cacheWriteState === "partial"
        ? t("usage.cacheWritePartial")
        : undefined;

  return (
    <motion.section
      aria-label={t("usage.metrics.label")}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative shrink-0 overflow-hidden rounded-xl glass-card p-4 shadow-sm md:p-5"
    >
      <div className="flex flex-col gap-4">
        {/* 顶行：品牌图标 + 真实消耗 Tokens，右侧请求数 / 成本胶囊 */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "rounded-xl bg-gradient-to-br p-2.5 shadow-sm",
                titleTheme.iconBg,
              )}
            >
              <AppGlyphIcon appType={appType} accentClass={titleTheme.accent} />
            </div>
            <div>
              <div className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-fg-2">
                {appLabel && (
                  <>
                    <span className={cn("font-semibold", titleTheme.accent)}>
                      {appLabel}
                    </span>
                    <span className="text-fg-3/30">•</span>
                  </>
                )}
                <span className="flex items-center gap-0.5">
                  {t("usage.realTotal")}
                  <HelpTip
                    title={t("usage.metrics.realTotalHelpTitle")}
                    align="start"
                  >
                    {t("usage.metrics.realTotalHelp")}
                  </HelpTip>
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className="text-2xl leading-none font-bold tracking-tight tabular-nums text-fg-1 md:text-3xl"
                  title={placeholder ?? fmtInt(realTotal, locale)}
                >
                  {placeholder ?? fmtInt(realTotal, locale)}
                </span>
                <span className="rounded-md bg-subtle px-1.5 py-0.5 text-xs font-medium text-fg-2">
                  <span aria-hidden="true">≈ </span>
                  <span>{formatTokensCompact(realTotal, locale)}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5 rounded-xl border border-border/40 bg-surface/50 px-4 py-2.5 shadow-sm">
            <div className="flex flex-col">
              <span className="text-[10px] font-medium tracking-wider text-fg-2 uppercase">
                {t("usage.totalRequests")}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-fg-1">
                <Activity className="h-3.5 w-3.5 text-blue-500" />
                {placeholder ?? fmtInt(requests, locale)}
              </span>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div className="flex flex-col">
              <span className="text-[10px] font-medium tracking-wider text-fg-2 uppercase">
                {t("usage.totalCost")}
              </span>
              <span
                className="text-sm font-semibold text-green-500 tabular-nums"
                title={totalCost == null ? undefined : moneyTitle(totalCost, 6)}
              >
                {placeholder ?? (totalCost == null ? "—" : money(totalCost, 2))}
              </span>
            </div>
          </div>
        </div>

        {/* 底行：彩色小卡（含第四版成功率）与动画命中率条 */}
        <div
          className={cn(
            "grid grid-cols-2 gap-3 md:grid-cols-3",
            compact ? "" : "xl:grid-cols-6",
          )}
        >
          <MiniStat
            icon={<ArrowDownToLine className="h-3.5 w-3.5" />}
            label={t("usage.freshInput")}
            value={formatTokensCompact(input, locale)}
            title={fmtInt(input, locale)}
            accent="text-blue-500"
          />
          <MiniStat
            icon={<ArrowUpFromLine className="h-3.5 w-3.5" />}
            label={t("usage.output")}
            value={formatTokensCompact(output, locale)}
            title={fmtInt(output, locale)}
            accent="text-purple-500"
          />
          <MiniStat
            icon={<Database className="h-3.5 w-3.5" />}
            label={t("usage.cacheWrite")}
            value={cacheWriteValue}
            title={cacheWriteState === "na" ? undefined : fmtInt(cacheWrite)}
            accent="text-amber-500"
            muted={cacheWriteState === "na"}
            helpBody={cacheWriteHelp}
          />
          <MiniStat
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label={t("usage.cacheRead")}
            value={formatTokensCompact(cacheRead, locale)}
            title={fmtInt(cacheRead, locale)}
            accent="text-emerald-500"
          />
          <MiniStat
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            label={t("usage.successRate")}
            value={formatHitRatePercent(successRate / 100)}
            accent="text-green-500"
          />

          <div className="col-span-2 flex flex-col justify-center rounded-panel border border-border/40 bg-surface/40 p-3 shadow-sm md:col-span-1">
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-0.5 font-medium text-fg-2">
                {t("usage.cacheHitRate")}
                <HelpTip title={t("usage.metrics.hitRateHelpTitle")}>
                  {t("usage.metrics.hitRateHelp")}
                </HelpTip>
              </span>
              <span className="font-bold text-emerald-500 tabular-nums">
                {placeholder ??
                  (hitRateKnown ? formatHitRatePercent(hitRate) : "—")}
              </span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-subtle">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.max(0, Math.min(100, hitRate * 100))}%`,
                }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

interface MiniStatProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  title?: string;
  /** 可选悬停说明（如缓存写入的协议口径） */
  helpBody?: string;
  /** 视觉弱化（如 N/A） */
  muted?: boolean;
}

function MiniStat({
  icon,
  label,
  value,
  accent,
  title,
  helpBody,
  muted,
}: MiniStatProps) {
  return (
    <div
      className="flex flex-col gap-1 rounded-panel border border-border/40 bg-surface/40 p-3 shadow-sm"
      title={title}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-medium text-fg-2",
          accent,
        )}
      >
        {icon}
        <span className="flex min-w-0 items-center gap-0.5 text-fg-1/70">
          <span className="truncate tracking-wide">{label}</span>
          {helpBody && <HelpTip title={label}>{helpBody}</HelpTip>}
        </span>
      </div>
      <div
        className={cn(
          "text-sm font-semibold tabular-nums",
          muted ? "text-fg-3" : "text-fg-1",
        )}
      >
        {value}
      </div>
    </div>
  );
}
