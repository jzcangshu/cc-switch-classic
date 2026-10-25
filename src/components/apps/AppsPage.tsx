import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpCircle,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Stethoscope,
  Trash2,
} from "lucide-react";
import type { AppId } from "@/lib/api";
import { providersApi } from "@/lib/api/providers";
import type { ToolInstallationReport } from "@/lib/api/settings";
import type { VisibleApps } from "@/types";
import { DEFAULT_VISIBLE_APPS } from "@/config/appConfig";
import { useSettings } from "@/hooks/useSettings";
import { isUpdateAvailable } from "@/lib/version";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { HelpTip } from "@/components/ui/help-tip";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppPageHeader } from "@/components/shell/AppPageHeader";
import { APP_DISPLAY_NAME, AppGlyph } from "@/components/shell/AppGlyph";
import { ToolUpgradeConfirmDialog } from "@/components/settings/ToolUpgradeConfirmDialog";
import { ToolInstallRow } from "@/components/settings/ToolInstallRow";
import { ToolErrorMessage } from "@/components/settings/ToolErrorMessage";
import { ToolUninstallConfirmDialog } from "./ToolUninstallConfirmDialog";
import { ManualUninstallDialog } from "./ManualUninstallDialog";
import {
  ENV_BADGE_CONFIG,
  ONE_CLICK_INSTALL_COMMANDS,
  TOOL_APP_IDS,
  TOOL_NAMES,
  toolDisplayName,
  useToolManagement,
  WSL_SHELL_FLAG_OPTIONS,
  WSL_SHELL_OPTIONS,
  type ToolLifecycleAction,
  type ToolName,
} from "./useToolManagement";

/** 安装来源的显示名：只标认得出的，认不出（system）就不标，免得标错。 */
const SOURCE_LABEL: Record<string, string> = {
  homebrew: "Homebrew",
  nvm: "npm",
  volta: "npm",
  fnm: "npm",
  mise: "npm",
  bun: "bun",
  pnpm: "pnpm",
  scoop: "Scoop",
  pip: "pip",
};

type Row = { kind: "tool"; tool: ToolName } | { kind: "desktop" };

const ROWS: Row[] = [
  { kind: "tool", tool: "claude" },
  { kind: "desktop" },
  ...TOOL_NAMES.filter((tool) => tool !== "claude").map(
    (tool): Row => ({ kind: "tool", tool }),
  ),
];

const CARD_CLASS =
  "flex min-h-[150px] flex-col gap-3 rounded-panel border border-border bg-surface p-4";

function formatCheckedAt(timestamp: number, locale: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const time = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return date.toDateString() === now.toDateString()
    ? time
    : `${date.toLocaleDateString(locale, { month: "numeric", day: "numeric" })} ${time}`;
}

/**
 * 「应用」页（第三版卡片网格形态）：每个工具一张圆角卡 = 图标 + 名称 + 环境徽章 +
 * 「当前版本 / 最新版本」两行 + 「安装 / 升级」按钮；「显示」开关和 ⋯ 菜单
 * （手动命令、来源与路径、卸载）在卡片右上角。
 * 隐藏一个应用只影响界面（侧栏、MCP / Skills 的列、提示词和会话的下拉），配置照常同步。
 */
interface AppsPageProps {
  /**
   * 关于页内嵌形态（第三版本地环境检查）：不渲染独立页头，
   * 页头操作改为节内标题行，由「设置 → 关于」承载。
   */
  embedded?: boolean;
}

export function AppsPage({ embedded = false }: AppsPageProps = {}) {
  const { t, i18n } = useTranslation();
  const tools = useToolManagement();
  const { settings, updateSettings, autoSaveSettings } = useSettings();

  const [showCommands, setShowCommands] = useState(false);
  const [showUninstallCommands, setShowUninstallCommands] = useState(false);
  const [pendingUninstall, setPendingUninstall] = useState<ToolName | null>(
    null,
  );
  const [expanded, setExpanded] = useState<Partial<Record<ToolName, boolean>>>(
    {},
  );
  // 「诊断安装冲突」（和升级后的自动补诊）有结果的卡片自动展开，否则点了诊断看起来没反应
  const diagnosedTools = Object.keys(tools.toolDiagnostics) as ToolName[];
  useEffect(() => {
    if (diagnosedTools.length === 0) return;
    setExpanded((prev) => {
      const next = { ...prev };
      for (const tool of diagnosedTools) next[tool] = true;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools.toolDiagnostics]);
  const { data: desktopStatus } = useQuery({
    queryKey: ["claude-desktop-status"],
    queryFn: () => providersApi.getClaudeDesktopStatus(),
    staleTime: 30_000,
  });

  const visibleApps: VisibleApps = {
    ...DEFAULT_VISIBLE_APPS,
    ...settings?.visibleApps,
  };
  const visibleCount = Object.values(visibleApps).filter(Boolean).length;

  const setVisible = (app: AppId, visible: boolean) => {
    if (!settings) return;
    // 至少留一个应用在侧栏
    if (!visible && visibleCount <= 1) return;
    const next = { ...visibleApps, [app]: visible };
    const previous = settings.visibleApps;
    updateSettings({ visibleApps: next });
    void autoSaveSettings({ visibleApps: next }).catch(() =>
      updateSettings({ visibleApps: previous }),
    );
  };

  const visibilitySwitch = (app: AppId) => (
    <Switch
      size="sm"
      checked={visibleApps[app]}
      disabled={!settings || (visibleApps[app] && visibleCount <= 1)}
      onCheckedChange={(checked) => setVisible(app, checked)}
      aria-label={t("appsPage.showInSidebar", { name: APP_DISPLAY_NAME[app] })}
    />
  );

  // 检查更新时各工具逐个进入加载，可升级列表会先清零再逐个回来；页头沿用检查前的数，
  // 检查完再一次性更新，免得「全部升级」闪没又出现、数字逐个跳。
  const settledUpdatableCount = useRef(0);
  if (!tools.isLoadingTools) {
    settledUpdatableCount.current = tools.updatableToolNames.length;
  }
  const updatableCount = tools.isLoadingTools
    ? settledUpdatableCount.current
    : tools.updatableToolNames.length;

  const lastChecked = tools.lastCheckedAt
    ? t("appsPage.lastChecked", {
        time: formatCheckedAt(tools.lastCheckedAt, i18n.language),
      })
    : t("appsPage.neverChecked");

  const headerActions = (
    <>
      <span className="whitespace-nowrap text-caption text-fg-3">
        {lastChecked}
      </span>
      <Button
        variant="quiet"
        size="regular"
        className="shrink-0 gap-1.5 text-fg-2"
        disabled={
          tools.isLoadingTools || tools.isAnyBusy || tools.isDiagnosingAll
        }
        onClick={() => void tools.handleDiagnoseAll()}
      >
        {tools.isDiagnosingAll ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Stethoscope className="h-3.5 w-3.5" />
        )}
        {tools.isDiagnosingAll
          ? t("settings.toolDiagnosing")
          : t("settings.toolDiagnose")}
      </Button>
      {(updatableCount > 0 || tools.batchAction) && (
        <Button
          variant="neutral"
          size="regular"
          disabled={tools.isLoadingTools || Boolean(tools.batchAction)}
          aria-busy={Boolean(tools.batchAction)}
          onClick={() =>
            void tools.handleRunToolAction(tools.updatableToolNames, "update", {
              fromBatchEntry: true,
            })
          }
        >
          {tools.batchAction === "update" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowUpCircle className="h-3.5 w-3.5" />
          )}
          {t("settings.updateAllTools", { count: updatableCount })}
        </Button>
      )}
      <Button
        variant="neutral"
        size="regular"
        disabled={tools.isLoadingTools || tools.isAnyBusy}
        onClick={() => void tools.checkForUpdates()}
      >
        <RefreshCw
          className={cn("h-3.5 w-3.5", tools.isLoadingTools && "animate-spin")}
        />
        {/* 两种文案叠在同一格，按钮按较宽的那个定宽，切换时不改变宽度 */}
        <span className="grid justify-items-center [&>*]:col-start-1 [&>*]:row-start-1">
          <span
            aria-hidden={tools.isLoadingTools}
            className={cn(tools.isLoadingTools && "invisible")}
          >
            {t("appsPage.checkUpdates")}
          </span>
          <span
            aria-hidden={!tools.isLoadingTools}
            className={cn(!tools.isLoadingTools && "invisible")}
          >
            {t("appsPage.checking")}
          </span>
        </span>
      </Button>
    </>
  );

  return (
    <>
      {embedded ? (
        /* 关于页内嵌：节内标题行（第三版本地环境检查形态），操作沿用页头同一组 */
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-6 pt-4">
          <div className="flex min-w-0 items-center gap-0.5">
            <h3 className="m-0 truncate text-strong font-semibold text-fg-1">
              {t("nav.apps")}
            </h3>
            <HelpTip title={t("appsPage.helpTitle")}>
              {t("appsPage.helpBody")}
            </HelpTip>
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {headerActions}
          </div>
        </div>
      ) : (
        <AppPageHeader
          icon={<LayoutGrid className="h-5 w-5" strokeWidth={1.5} />}
          title={t("nav.apps")}
          titleExtra={
            <HelpTip title={t("appsPage.helpTitle")}>
              {t("appsPage.helpBody")}
            </HelpTip>
          }
          actions={headerActions}
        />
      )}

      <div
        id={embedded ? undefined : "main-content"}
        className="min-h-0 flex-1 overflow-y-auto scroll-stable"
      >
        <div className="grid gap-3 px-6 pb-10 pt-4 sm:grid-cols-2 xl:grid-cols-3">
          {ROWS.map((row) =>
            row.kind === "desktop" ? (
              <DesktopCard
                key="claude-desktop"
                status={desktopStatus}
                visibility={visibilitySwitch("claude-desktop")}
              />
            ) : (
              <ToolCard
                key={row.tool}
                tool={row.tool}
                tools={tools}
                onUninstall={() => setPendingUninstall(row.tool)}
                onOpenInstallCommands={() => setShowCommands(true)}
                onOpenUninstallCommands={() => setShowUninstallCommands(true)}
                expanded={expanded[row.tool] ?? false}
                onToggleExpanded={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [row.tool]: !prev[row.tool],
                  }))
                }
                visibility={visibilitySwitch(TOOL_APP_IDS[row.tool])}
              />
            ),
          )}
        </div>
      </div>

      <Dialog open={showCommands} onOpenChange={setShowCommands}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("settings.manualInstallCommands")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-6">
            <p className="text-body text-fg-2">
              {t("settings.oneClickInstallHint")}
            </p>
            <pre className="max-h-[50vh] overflow-auto rounded-control border border-border bg-subtle px-3 py-2.5 font-mono text-caption">
              {ONE_CLICK_INSTALL_COMMANDS}
            </pre>
          </div>
          <DialogFooter>
            <Button
              variant="neutral"
              size="regular"
              onClick={() => setShowCommands(false)}
            >
              {t("common.close")}
            </Button>
            <Button
              variant="solid"
              size="regular"
              onClick={() => void tools.handleCopyInstallCommands()}
            >
              <Copy className="h-3.5 w-3.5" />
              {t("common.copy")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManualUninstallDialog
        open={showUninstallCommands}
        onOpenChange={setShowUninstallCommands}
        toolVersionByName={tools.toolVersionByName}
      />

      {pendingUninstall && (
        <ToolUninstallConfirmDialog
          tool={pendingUninstall}
          wslShellByTool={tools.wslShellByTool}
          onConfirm={(uninstallPlan) => {
            void tools.handleRunToolAction([pendingUninstall], "uninstall", {
              uninstallPlan,
            });
            setPendingUninstall(null);
          }}
          onCancel={() => setPendingUninstall(null)}
          onManualUninstall={() => {
            setPendingUninstall(null);
            setShowUninstallCommands(true);
          }}
        />
      )}

      <ToolUpgradeConfirmDialog
        isOpen={tools.pendingUpgrade !== null}
        plans={tools.pendingUpgrade?.plans ?? []}
        displayName={toolDisplayName}
        onConfirm={tools.handleConfirmUpgrade}
        onCancel={tools.handleCancelUpgrade}
      />
    </>
  );
}

function DesktopCard({
  status,
  visibility,
}: {
  status:
    | Awaited<ReturnType<typeof providersApi.getClaudeDesktopStatus>>
    | undefined;
  visibility: React.ReactNode;
}) {
  const { t } = useTranslation();
  const label =
    status?.supported === false
      ? t("appsPage.desktopUnsupported")
      : status?.configured
        ? t("appsPage.desktopConnected")
        : t("appsPage.desktopNotConnected");
  return (
    <div data-tool-row className={CARD_CLASS}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <AppGlyph app="claude-desktop" size={20} badgeClassName="bg-subtle" />
          <div className="min-w-0">
            <div className="truncate text-body font-medium text-fg-1">
              <span>{APP_DISPLAY_NAME["claude-desktop"]}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">{visibility}</div>
      </div>
      <div className="flex items-center gap-1.5 text-caption text-fg-2">
        <span
          className={cn(
            "rounded-[5px] px-1.5 text-badge leading-5",
            status?.configured
              ? "bg-success-soft text-success-text"
              : "bg-subtle text-fg-2",
          )}
        >
          {label}
        </span>
        <HelpTip title={APP_DISPLAY_NAME["claude-desktop"]}>
          {t("appsPage.desktopHelp")}
        </HelpTip>
      </div>
    </div>
  );
}

function ToolCard({
  tool,
  tools,
  onUninstall,
  onOpenInstallCommands,
  onOpenUninstallCommands,
  expanded,
  onToggleExpanded,
  visibility,
}: {
  tool: ToolName;
  tools: ReturnType<typeof useToolManagement>;
  onUninstall: () => void;
  onOpenInstallCommands: () => void;
  onOpenUninstallCommands: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  visibility: React.ReactNode;
}) {
  const { t } = useTranslation();
  const info = tools.toolVersionByName.get(tool);
  const report: ToolInstallationReport | undefined =
    tools.installReports?.[tool];
  const defaultInstall =
    report?.installs.find((install) => install.is_path_default) ??
    report?.installs[0];
  const otherInstalls = (report?.installs.length ?? 0) - 1;
  // 「诊断安装冲突」的结果优先（升级后会重新诊断），否则用打开页面时探测到的安装分布
  const installs = tools.toolDiagnostics[tool] ?? report?.installs;

  const isVersionLoading =
    Boolean(tools.loadingTools[tool]) ||
    (tools.isLoadingTools && !tools.toolVersionByName.has(tool));
  const isOutdated = isUpdateAvailable(info?.version, info?.latest_version);
  const nodeGap = isOutdated ? info?.update_blocked_by_node : null;
  const broken = Boolean(info?.installed_but_broken);
  const isBusy = tools.busyTools.has(tool);
  const busyAction = tools.busyTools.get(tool);
  const canUninstall = Boolean(info?.version || broken || defaultInstall);
  const action: Exclude<ToolLifecycleAction, "uninstall"> | null =
    (busyAction !== "uninstall" ? busyAction : undefined) ??
    (isVersionLoading || broken
      ? null
      : !info?.version
        ? "install"
        : isOutdated && !nodeGap
          ? "update"
          : null);
  const sourceLabel = defaultInstall
    ? SOURCE_LABEL[defaultInstall.source]
    : undefined;
  const envBadgeConfig = info?.env_type
    ? ENV_BADGE_CONFIG[info.env_type]
    : undefined;

  const currentVersion = isVersionLoading
    ? t("common.loading")
    : info?.version
      ? info.version
      : broken
        ? t("settings.installedNotRunnable")
        : t("common.notInstalled");
  const latestVersion = isVersionLoading
    ? t("common.loading")
    : (info?.latest_version ?? t("common.unknown"));
  const versionTitle = info?.version || info?.error || t("common.unknown");

  const installHint = t(`appsPage.installHint.${tool}`, { defaultValue: "" });

  const actionButton = action ? (
    <Button
      variant={action === "install" ? "outline" : "default"}
      size="compact"
      onClick={() => void tools.handleRunToolAction([tool], action)}
      disabled={isVersionLoading || isBusy}
      aria-busy={isBusy}
    >
      {isBusy && busyAction !== "uninstall" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : action === "install" ? (
        <Download className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpCircle className="h-3.5 w-3.5" />
      )}
      {action === "install"
        ? t("settings.toolInstall")
        : t("settings.toolUpdate")}
    </Button>
  ) : null;

  const wslControls =
    info?.env_type === "wsl" ? (
      <div className="flex flex-wrap items-center gap-2 text-caption text-fg-2">
        <span>Shell</span>
        <Select
          value={tools.wslShellByTool[tool]?.wslShell || "auto"}
          onValueChange={(value) =>
            void tools.handleToolShellChange(tool, value)
          }
          disabled={isVersionLoading || isBusy}
        >
          <SelectTrigger className="h-7 w-[82px] text-caption">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">{t("common.auto")}</SelectItem>
            {WSL_SHELL_OPTIONS.map((shell) => (
              <SelectItem key={shell} value={shell}>
                {shell}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>{t("appsPage.wslFlag")}</span>
        <Select
          value={tools.wslShellByTool[tool]?.wslShellFlag || "auto"}
          onValueChange={(value) =>
            void tools.handleToolShellFlagChange(tool, value)
          }
          disabled={isVersionLoading || isBusy}
        >
          <SelectTrigger className="h-7 w-[82px] text-caption">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">{t("common.auto")}</SelectItem>
            {WSL_SHELL_FLAG_OPTIONS.map((flag) => (
              <SelectItem key={flag} value={flag}>
                {flag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ) : null;

  const errorLine =
    !isVersionLoading && !info?.version && info?.error ? (
      <ToolErrorMessage message={info.error} />
    ) : null;

  const nodeLine =
    !isVersionLoading && nodeGap ? (
      <p className="flex items-start gap-1 text-caption text-warning-text">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t("appsPage.updateNeedsNode", {
          version: info?.latest_version,
          required: nodeGap.required,
          current: nodeGap.current,
        })}
      </p>
    ) : null;

  const conflictList =
    expanded && installs && installs.length > 1 ? (
      <div className="space-y-1.5 rounded-control bg-warning-soft p-2.5">
        <div className="text-caption font-medium text-warning-text">
          {t("appsPage.installsFound", { count: installs.length })}
        </div>
        <ul className="space-y-1">
          {installs.map((install) => (
            <li key={install.path}>
              <ToolInstallRow inst={install} />
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const statusIcon = isVersionLoading ? (
    <Loader2
      aria-label={t("common.loading")}
      className="h-4 w-4 animate-spin text-fg-3"
    />
  ) : info?.version ? (
    isOutdated ? (
      <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] text-yellow-600 dark:text-yellow-400">
        {t("settings.updateAvailableShort")}
      </span>
    ) : (
      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
    )
  ) : broken ? (
    <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500" />
  ) : null;

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="quiet"
          size="icon-compact"
          className="h-8 w-8"
          aria-label={t("appPage.moreActions", {
            name: toolDisplayName(tool),
          })}
          disabled={busyAction === "uninstall"}
          aria-busy={busyAction === "uninstall"}
        >
          {busyAction === "uninstall" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        {(sourceLabel || defaultInstall) && (
          <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
            <span className="text-caption text-fg-2">
              {t("appsPage.sourceAndPath")}
            </span>
            <span className="font-mono text-caption text-fg-1">
              {sourceLabel ?? t("common.unknown")}
            </span>
            {defaultInstall && (
              <span
                className="max-w-[280px] truncate font-mono text-caption text-fg-2"
                title={defaultInstall.path}
              >
                {defaultInstall.path}
              </span>
            )}
          </DropdownMenuLabel>
        )}
        <DropdownMenuItem onSelect={onOpenInstallCommands}>
          {t("appsPage.manualCommands")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenUninstallCommands}>
          {t("settings.manualUninstallCommands")}
        </DropdownMenuItem>
        {canUninstall && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onUninstall}
              className="text-danger-text focus:text-danger-text"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("settings.toolUninstall")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div data-tool-row className={CARD_CLASS}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <AppGlyph
            app={TOOL_APP_IDS[tool]}
            size={20}
            badgeClassName="bg-subtle"
          />
          <div className="min-w-0">
            <div className="truncate text-body font-medium text-fg-1">
              <span>{toolDisplayName(tool)}</span>
            </div>
            {envBadgeConfig && (
              <span
                className={cn(
                  "mt-1 inline-flex w-fit rounded-full border px-1.5 py-0.5 text-[9px]",
                  envBadgeConfig.className,
                )}
              >
                {t(envBadgeConfig.labelKey)}
                {info?.env_type === "wsl" && info.wsl_distro
                  ? ` · ${info.wsl_distro}`
                  : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {statusIcon}
          {visibility}
          {menu}
        </div>
      </div>

      <div className="space-y-1.5 text-caption">
        <div className="flex items-center justify-between gap-3">
          <span className="text-fg-2">{t("settings.currentVersion")}</span>
          <span
            className="min-w-0 truncate font-mono text-fg-1"
            title={versionTitle}
          >
            {currentVersion}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-fg-2">{t("settings.latestVersion")}</span>
          <span className="min-w-0 truncate font-mono text-fg-1">
            {latestVersion}
          </span>
        </div>
        {!isVersionLoading && !info?.version && !info?.error && installHint && (
          <div className="truncate text-fg-3" title={installHint}>
            {installHint}
          </div>
        )}
        {errorLine}
        {nodeLine}
      </div>

      {wslControls}

      {(otherInstalls > 0 || conflictList) && (
        <div className="space-y-2">
          {otherInstalls > 0 && (
            <button
              type="button"
              onClick={onToggleExpanded}
              aria-expanded={expanded}
              className="inline-flex items-center gap-0.5 text-caption font-medium text-warning-text hover:underline"
            >
              {t("appsPage.otherInstalls", { count: otherInstalls })}
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  expanded && "rotate-180",
                )}
              />
            </button>
          )}
          {conflictList}
        </div>
      )}

      <div className="mt-auto flex items-center justify-end gap-2">
        {isVersionLoading ? (
          <span className="text-caption text-fg-2">{t("common.loading")}</span>
        ) : broken ? (
          // 已安装但跑不起来：重装无济于事，不给按钮，给一句指向环境的提示。
          <span className="text-caption text-warning-text">
            {t("settings.toolCheckEnv")}
          </span>
        ) : action ? (
          actionButton
        ) : (
          <span className="text-caption text-fg-2">
            {t("settings.toolReady")}
          </span>
        )}
      </div>
    </div>
  );
}
