import { useTranslation } from "react-i18next";
import { AlertTriangle, BarChart2, KeyRound } from "lucide-react";
import { useSettingsQuery } from "@/lib/query";
import { useSidebarStatus } from "@/hooks/useSidebarStatus";
import { useMoneyFormat } from "@/hooks/useMoneyFormat";
import { APP_IDS } from "@/config/appConfig";
import type { AppId } from "@/lib/api";
import type { VisibleApps } from "@/types";
import { APP_DISPLAY_NAME } from "./AppGlyph";
import {
  fmtInt,
  formatHitRatePercent,
  formatTokensCompact,
  getLocaleFromLanguage,
  getResolvedLang,
  resolveSidebarToday,
  type SidebarTodayItem,
} from "@/components/usage/format";

/** 侧栏原有的今日指标和异常提醒，迁到不占正文宽度的底部状态区。 */
export function ClassicStatusBar({
  visibleApps,
  onOpenApp,
  onOpenPage,
}: {
  visibleApps: VisibleApps;
  onOpenApp: (app: AppId) => void;
  onOpenPage: (page: "auth" | "usage") => void;
}) {
  const { t, i18n } = useTranslation();
  const { data: settings } = useSettingsQuery();
  const { moneyShort } = useMoneyFormat();
  const {
    appStatus,
    todayCost,
    todayTokens,
    todayRequests,
    todayHitRate,
    authNeedsAttention,
  } = useSidebarStatus();
  const locale = getLocaleFromLanguage(getResolvedLang(i18n));
  const value = (item: SidebarTodayItem) => {
    switch (item) {
      case "cost":
        return todayCost > 0 ? moneyShort(todayCost) : null;
      case "tokens":
        return todayTokens > 0
          ? formatTokensCompact(todayTokens, locale)
          : null;
      case "requests":
        return todayRequests > 0
          ? t("nav.todayRequests", { value: fmtInt(todayRequests, locale) })
          : null;
      case "hitRate":
        return todayRequests > 0
          ? t("nav.todayHitRate", { value: formatHitRatePercent(todayHitRate) })
          : null;
    }
  };
  const today = resolveSidebarToday(settings?.usageDisplay)
    .map(value)
    .filter((part): part is string => part !== null);
  const alerts = APP_IDS.filter(
    (app) => visibleApps[app] && appStatus(app).alert,
  );
  if (!today.length && !authNeedsAttention && !alerts.length) return null;
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-end gap-4 border-t border-border px-6 py-2 text-xs text-muted-foreground">
      {alerts.map((app) => (
        <button
          key={app}
          type="button"
          className="flex items-center gap-1 text-amber-600 hover:underline"
          onClick={() => onOpenApp(app)}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {APP_DISPLAY_NAME[app]} ·{" "}
          {t("nav.routeServiceDown", { defaultValue: "路由服务已停止" })}
        </button>
      ))}
      {authNeedsAttention && (
        <button
          type="button"
          className="flex items-center gap-1 text-amber-600 hover:underline"
          onClick={() => onOpenPage("auth")}
        >
          <KeyRound className="h-3.5 w-3.5" />
          {t("nav.authNeedsReauth")}
        </button>
      )}
      {today.length > 0 && (
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => onOpenPage("usage")}
        >
          <BarChart2 className="h-3.5 w-3.5" />
          {t("nav.today", { value: today.join(" · ") })}
        </button>
      )}
    </footer>
  );
}
