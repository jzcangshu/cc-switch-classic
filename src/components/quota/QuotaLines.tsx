import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, Check, Clock, RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { HoverTip } from "@/components/ui/hover-tip";
import {
  barPercent,
  cardRows,
  FAILED_LINE_KEY,
  countdownStr,
  formatRelativeTime,
  lineHint,
  resetText,
  type QuotaBreakdown,
  type QuotaLine,
  type QuotaTone,
} from "./quotaRules";
import { QuotaBreakdownChevron, QuotaBreakdownRow } from "./QuotaBreakdown";

/** 沿用 v3 的绿 / 橙 / 红：全灰时几档额度看不出差别（用户反馈） */
export const TONE_TEXT: Record<QuotaTone, string> = {
  normal: "text-green-600 dark:text-green-400",
  muted: "text-fg-3",
  warning: "text-orange-500 dark:text-orange-400",
  danger: "text-red-500 dark:text-red-400",
  plain: "",
};

export const TONE_FILL: Record<QuotaTone, string> = {
  normal: "bg-green-500",
  muted: "bg-chart-1",
  warning: "bg-orange-500",
  danger: "bg-red-500",
  plain: "bg-chart-1",
};

/**
 * 只给数值上色（「5 小时剩余 88%」里的「88%」），档名和「剩余」跟外层的灰字；
 * 句子里没有单独的数值（用完、过期、没查到）时整句上色。className 不传时不上色
 */
export function TonedText({
  text,
  line,
  className = TONE_TEXT[line.tone],
}: {
  text: string;
  line: Pick<QuotaLine, "tone" | "emphasis">;
  className?: string;
}) {
  if (!className) return <>{text}</>;
  const at = line.emphasis ? text.lastIndexOf(line.emphasis) : -1;
  if (at < 0) return <span className={className}>{text}</span>;
  const end = at + line.emphasis!.length;
  return (
    <>
      {text.slice(0, at)}
      <span className={className}>{line.emphasis}</span>
      {text.slice(end)}
    </>
  );
}

/** 每 30 秒刷新一次「x 分钟前」和重置倒计时 */
export function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/** 单档重置倒计时：只在有有效时间时显示，不占固定列宽。 */
export function ResetSlot({
  countdown,
  className = "ms-0.5",
}: {
  countdown: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!countdown) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 text-muted-foreground/60",
        className,
      )}
    >
      <Clock aria-hidden className="h-2.5 w-2.5 shrink-0" strokeWidth={2} />
      <span className="sr-only">
        {t("subscription.resetsIn", { time: countdown })}
      </span>
      <span aria-hidden>{countdown}</span>
    </span>
  );
}

/** 点一下重查后图标至少转这么久：请求常常不到一秒，太短了看不出来查过 */
export const MIN_REFRESH_SPIN_MS = 600;
/** 查完后 ✓ / ✗ 停留多久 */
export const REFRESH_RESULT_MS = 1000;

type RefreshPhase =
  | { kind: "idle" }
  | {
      kind: "spinning";
      since: number;
      /** onRefresh 返回的 Promise 有结果了（没返回 Promise 时一开始就算有） */
      settled: boolean;
      /** 这次请求本身失败了 */
      rejected: boolean;
    }
  | { kind: "succeeded" }
  | { kind: "failed" };

/** refetch 可能保留旧成功值；请求错误和业务失败都不能显示成功反馈。 */
function isRejectedResult(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return false;
  const queryResult = result as {
    isError?: unknown;
    data?: { success?: unknown };
  };
  return queryResult.isError === true || queryResult.data?.success === false;
}

/**
 * 点击触发的重查：从点下去开始转，直到查完且满 MIN_REFRESH_SPIN_MS，再按结果换成 ✓ 或 ✗
 * 停一会儿。✗ 不能省：本来就没查到、再点又失败时，红字前后一模一样，没有它就像没点过。
 *
 * 成败两头看：额度列换成了「查询失败」，或 refetch() 的结果是失败——后者管的是
 * 「保留上次成功值」窗口里的瞬时失败（界面照旧显示旧值，只看额度行会误打 ✓）。
 * 要等 Promise 有结果且 loading 落下（新的额度行已渲染）两件事都到，才下结论。
 *
 * 只认点击，后台轮询 / 窗口聚焦的重查不转（照旧只变淡），免得几张卡片一起闪
 */
function useClickRefreshFeedback(loading: boolean, failed: boolean) {
  const [phase, setPhase] = useState<RefreshPhase>({ kind: "idle" });
  useEffect(() => {
    if (phase.kind === "idle") return;
    if (phase.kind === "spinning") {
      if (loading || !phase.settled) return;
      const wait = Math.max(0, phase.since + MIN_REFRESH_SPIN_MS - Date.now());
      const outcome = failed || phase.rejected ? "failed" : "succeeded";
      const timer = setTimeout(() => setPhase({ kind: outcome }), wait);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(
      () => setPhase({ kind: "idle" }),
      REFRESH_RESULT_MS,
    );
    return () => clearTimeout(timer);
  }, [phase, loading, failed]);

  const start = (result: unknown) => {
    const since = Date.now();
    const thenable =
      typeof (result as PromiseLike<unknown> | undefined)?.then === "function";
    setPhase({ kind: "spinning", since, settled: !thenable, rejected: false });
    if (!thenable) return;
    const settle = (rejected: boolean) =>
      setPhase((current) =>
        current.kind === "spinning" && current.since === since
          ? { ...current, settled: true, rejected }
          : current,
      );
    Promise.resolve(result).then(
      (value) => settle(isRejectedResult(value)),
      () => settle(true),
    );
  };

  return { phase: phase.kind, start };
}

interface QuotaLinesProps {
  lines: QuotaLine[];
  max?: number;
  queriedAt?: number | null;
  loading?: boolean;
  /** 返回 refetch() 的 Promise 时，点击后的 ✓ / ✗ 也认请求本身的成败 */
  onRefresh?: () => unknown;
  /** 卡片上放不下的各档：整列做成一个下拉（Antigravity 四档，见 tierBreakdown） */
  breakdown?: QuotaBreakdown;
}

/**
 * 第三版紧凑额度：第一行常驻查询时间与刷新，第二行横排彩色徽章。
 * 保留 cardRows 的选档规则和请求结果反馈，新增明细使用独立按钮。
 */
export function QuotaLines({
  lines,
  max = 2,
  queriedAt,
  loading = false,
  onRefresh,
  breakdown,
}: QuotaLinesProps) {
  const { t } = useTranslation();
  const now = useNow(Boolean(queriedAt) || lines.some((line) => line.resetsAt));
  const failed = lines.some((line) => line.key === FAILED_LINE_KEY);
  const refresh = useClickRefreshFeedback(loading, failed);
  const spinning = refresh.phase === "spinning";
  const ResultIcon = refresh.phase === "failed" ? X : Check;
  const selected = cardRows(lines, max).flat();
  if (selected.length === 0) return null;

  const title = [
    ...lines.map((line) => lineHint(t, line, now)),
    queriedAt
      ? t("quota.updatedAt", { time: formatRelativeTime(queriedAt, now, t) })
      : null,
  ]
    .filter(Boolean)
    .join("\n");
  const busy = loading || spinning;
  const badges = selected.map((line) => {
    const content = <QuotaBadge line={line} now={now} />;
    return line.breakdown && !breakdown ? (
      <QuotaBreakdownRow
        key={line.key}
        line={line}
        breakdown={line.breakdown}
        align="end"
        className="inline-flex items-center gap-0.5"
      >
        {content}
        <QuotaBreakdownChevron />
      </QuotaBreakdownRow>
    ) : (
      <span
        key={line.key}
        className="max-w-full"
        title={lineHint(t, line, now)}
      >
        {content}
      </span>
    );
  });

  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full flex-col items-end gap-1 text-xs tabular-nums",
        loading && !spinning && "opacity-60",
      )}
      title={title}
    >
      <div className="flex items-center justify-end gap-2">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
          <Clock aria-hidden data-testid="quota-update-clock" size={10} />
          {queriedAt
            ? formatRelativeTime(queriedAt, now, t)
            : t("usage.never", { defaultValue: "从未更新" })}
        </span>
        {onRefresh && (
          <button
            type="button"
            title={title}
            aria-label={t("quota.clickToRefresh")}
            aria-busy={busy}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              refresh.start(onRefresh());
            }}
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {refresh.phase === "succeeded" || refresh.phase === "failed" ? (
              <ResultIcon
                aria-hidden
                data-testid={`quota-refresh-${refresh.phase}`}
                size={12}
                className={
                  refresh.phase === "failed"
                    ? TONE_TEXT.danger
                    : "text-green-600 dark:text-green-400"
                }
              />
            ) : (
              <RefreshCw
                aria-hidden
                data-testid="quota-refresh-icon"
                size={12}
                className={spinning ? "motion-safe:animate-spin" : undefined}
              />
            )}
          </button>
        )}
      </div>
      {breakdown ? (
        <QuotaBreakdownRow
          breakdown={breakdown}
          align="end"
          className="flex max-w-full flex-wrap items-center justify-end gap-x-2 gap-y-1"
        >
          {badges}
          <QuotaBreakdownChevron />
        </QuotaBreakdownRow>
      ) : (
        <div
          className={cn(
            "flex max-w-full items-center gap-x-2 gap-y-1",
            failed ? "flex-col items-end" : "flex-wrap justify-end",
          )}
        >
          {badges}
        </div>
      )}
    </div>
  );
}

/** 档名与数字复用第四版额度行，保留剩余/已用语义及新增数据。 */
function QuotaBadge({ line, now }: { line: QuotaLine; now: number }) {
  const value = line.label && line.value ? line.value : line.text;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 text-gray-500 dark:text-gray-400",
        line.tone === "muted"
          ? "break-words whitespace-normal"
          : "whitespace-nowrap",
      )}
    >
      {line.key === FAILED_LINE_KEY && (
        <AlertCircle aria-hidden size={12} className={TONE_TEXT.danger} />
      )}
      {line.label && line.value && <span>{line.label}:</span>}
      <TonedText
        text={value}
        line={line}
        className={cn(
          line.tone !== "muted" && "font-semibold",
          TONE_TEXT[line.tone],
        )}
      />
      <ResetSlot countdown={countdownStr(line.resetsAt, now)} />
    </span>
  );
}

interface QuotaBarsProps {
  /** 每档的名字和那一行（名字单独一列） */
  rows: { label: string; line: QuotaLine; note?: string }[];
  title?: ReactNode;
  queriedAt?: number | null;
  loading?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  className?: string;
}

const BAR_ROW_CLASS = "flex min-w-0 flex-wrap items-center gap-3 text-xs";

/** 展开的额度条（授权中心、多套餐展开）：条长跟着数值（剩余或已用，见 barPercent） */
export function QuotaBars({
  rows,
  title,
  queriedAt,
  loading = false,
  onRefresh,
  footer,
  className,
}: QuotaBarsProps) {
  const { t } = useTranslation();
  const now = useNow(
    Boolean(queriedAt) || rows.some(({ line }) => line.resetsAt),
  );

  return (
    <div
      className={cn(
        "rounded-xl border border-border-default bg-card px-4 py-3 shadow-sm",
        className,
      )}
    >
      {(title || queriedAt || onRefresh) && (
        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-fg-2">{title}</span>
          <span className="flex items-center gap-2 text-muted-foreground/70">
            <span className="flex items-center gap-1 text-[10px]">
              <Clock aria-hidden size={10} />
              {queriedAt
                ? formatRelativeTime(queriedAt, now, t)
                : t("usage.never", { defaultValue: "从未更新" })}
            </span>
            {onRefresh && (
              <HoverTip content={t("subscription.refresh")}>
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  className="rounded-control p-1 text-fg-3 hover:bg-subtle hover:text-fg-1 disabled:opacity-50"
                  aria-label={t("subscription.refresh")}
                >
                  <RefreshCw
                    className={cn("h-3 w-3", loading && "animate-spin")}
                  />
                </button>
              </HoverTip>
            )}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {rows.map(({ label, line, note }) => {
          const width = barPercent(line);
          // 展开时地方够，重置时间直接写在数值后面（卡片上跟在各徽章后面）
          const trailing = [resetText(t, line, now), note]
            .filter(Boolean)
            .join(" · ");
          const cells = (
            <>
              <span className="min-w-0 basis-1/4 truncate font-medium text-gray-500 dark:text-gray-400">
                {label}
              </span>
              {line.caption ? (
                <span className="flex min-w-0 flex-1 items-center gap-0.5 text-fg-3">
                  <span className="truncate">{line.caption}</span>
                  {line.breakdown && <QuotaBreakdownChevron />}
                </span>
              ) : (
                <span
                  role="meter"
                  aria-label={`${label}: ${line.value ?? line.text}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(width)}
                  className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                >
                  <span
                    className={cn(
                      "absolute inset-y-0 start-0 rounded-full",
                      TONE_FILL[line.tone],
                    )}
                    style={{ width: `${width}%` }}
                  />
                </span>
              )}
              <span className="shrink-0 text-end font-semibold tabular-nums whitespace-nowrap text-fg-1">
                <TonedText
                  text={line.value ?? line.text}
                  line={line}
                  className={TONE_TEXT[line.tone]}
                />
              </span>
              {trailing && (
                <span className="min-w-0 truncate text-fg-3">{trailing}</span>
              )}
            </>
          );
          return line.breakdown ? (
            <QuotaBreakdownRow
              key={line.key}
              line={line}
              breakdown={line.breakdown}
              className={BAR_ROW_CLASS}
            >
              {cells}
            </QuotaBreakdownRow>
          ) : (
            <div key={line.key} className={BAR_ROW_CLASS} title={line.detail}>
              {cells}
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
