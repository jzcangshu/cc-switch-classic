import { useMemo, useState, useEffect } from "react";
import {
  AlertTriangle,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import type { Provider } from "@/types";
import type { AppId } from "@/lib/api";
import { authApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ProviderIcon } from "@/components/ProviderIcon";
import { HoverTip } from "@/components/ui/hover-tip";
import UsageFooter from "@/components/UsageFooter";
import SubscriptionQuotaFooter from "@/components/SubscriptionQuotaFooter";
import CopilotQuotaFooter from "@/components/CopilotQuotaFooter";
import CodexOauthQuotaFooter from "@/components/CodexOauthQuotaFooter";
import XaiOauthQuotaFooter from "@/components/XaiOauthQuotaFooter";
import AgyAccountQuotaFooter from "@/components/AgyAccountQuotaFooter";
import { PROVIDER_TYPES, TEMPLATE_TYPES } from "@/config/constants";
import {
  extractCodexExperimentalBearerToken,
  extractProviderBaseUrl,
} from "@/utils/providerConfigUtils";
import { resolveManagedAccountId } from "@/lib/authBinding";
import { isMac } from "@/lib/platform";
import { resolveCodexOfficialIdentity } from "@/utils/providerCapabilities";
import { useProviderHealth } from "@/lib/query/failover";
import { useUsageQuery } from "@/lib/query/queries";
import { resolveProviderIcon } from "@/utils/providerIcon";
import { isAdditiveAppId, isProxyAppId } from "@/config/appConfig";
import { ProviderCardActions } from "./ProviderCardActions";
import type { CardChip, CardPresentation, CardTone } from "./presentation";

interface DragHandleProps {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  isDragging: boolean;
}

interface ProviderCardProps {
  provider: Provider;
  appId: AppId;
  /** 卡片怎么画：模式色、状态 / 按钮、徽标（由列表按模式算好） */
  presentation: CardPresentation;
  /** 用来决定额度是否自动查询（共存式应用看 isInConfig） */
  isCurrent: boolean;
  isInConfig?: boolean;
  onEdit: (provider: Provider) => void;
  onDelete: (provider: Provider) => void;
  onConfigureUsage: (provider: Provider) => void;
  onOpenWebsite: (url: string) => void;
  onDuplicate?: (provider: Provider) => void;
  onTest?: (provider: Provider) => void;
  onOpenTerminal?: (provider: Provider) => void;
  isTesting?: boolean;
  dragHandleProps?: DragHandleProps;
}

/** 直连和共存式默认项沿用蓝色高亮，路由与聚合沿用绿色高亮。 */
const TONE_CLASS: Record<CardTone, string> = {
  direct: "border-blue-500/60 shadow-sm shadow-blue-500/10",
  route: "border-emerald-500/60 shadow-sm shadow-emerald-500/10",
  stack: "border-emerald-500/60 shadow-sm shadow-emerald-500/10",
  neutral: "border-blue-500/60 shadow-sm shadow-blue-500/10",
};

const CHIP_CLASS: Record<CardChip["tone"], string> = {
  outline:
    "bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200",
  direct: "bg-direct-soft text-direct-text",
  route: "bg-route-soft text-route-text",
  stack: "bg-stack-soft text-stack-text",
  success: "bg-success-soft text-success-text",
  warning: "bg-warning-soft text-warning-text",
  danger: "bg-danger-soft text-danger-text",
};

const CHIP_KEY_CLASS: Record<string, string> = {
  needsRoute: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  priority:
    "rounded bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400",
  omo: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  slim: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
};

export function CardChipBadge({ chip }: { chip: CardChip }) {
  return (
    <span
      title={chip.title}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
        CHIP_KEY_CLASS[chip.key] ?? CHIP_CLASS[chip.tone],
        chip.title && "cursor-help",
      )}
    >
      {chip.label}
    </span>
  );
}

function HealthChip({
  consecutiveFailures,
  isHealthy,
}: {
  consecutiveFailures: number;
  isHealthy?: boolean;
}) {
  const { t } = useTranslation();
  const status =
    consecutiveFailures === 0
      ? {
          label: t("health.operational"),
          dot: "bg-green-500",
          className: "bg-green-500/10 text-green-600 dark:text-green-400",
        }
      : isHealthy !== false
        ? {
            label: t("health.degraded"),
            dot: "bg-yellow-500",
            className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
          }
        : {
            label: t("health.circuitOpen"),
            dot: "bg-red-500",
            className: "bg-red-500/10 text-red-600 dark:text-red-400",
          };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium",
        status.className,
      )}
      title={t("health.consecutiveFailures", { count: consecutiveFailures })}
    >
      <span
        aria-hidden="true"
        className={cn("h-2 w-2 rounded-full", status.dot)}
      />
      {status.label}
    </span>
  );
}

/** 判断是否为官方供应商（无自定义 base URL / API key，直连官方 API） */
function isOfficialProvider(provider: Provider, appId: AppId): boolean {
  if (provider.category === "official") {
    return true;
  }

  const config = provider.settingsConfig as Record<string, any>;
  if (appId === "claude") {
    const baseUrl = config?.env?.ANTHROPIC_BASE_URL;
    return !baseUrl || (typeof baseUrl === "string" && baseUrl.trim() === "");
  }
  if (appId === "codex") {
    // 无 OPENAI_API_KEY → 使用 Codex CLI 内置 OAuth（官方）
    const apiKey = config?.auth?.OPENAI_API_KEY;
    const bearerToken =
      typeof config?.config === "string"
        ? extractCodexExperimentalBearerToken(config.config)
        : undefined;
    return (
      !bearerToken &&
      (!apiKey || (typeof apiKey === "string" && apiKey.trim() === ""))
    );
  }
  if (appId === "gemini" || appId === "agy") {
    // 无 GEMINI_API_KEY 且无 GOOGLE_GEMINI_BASE_URL → Google OAuth 官方模式
    const apiKey = config?.env?.GEMINI_API_KEY;
    const baseUrl = config?.env?.GOOGLE_GEMINI_BASE_URL;
    return (
      (!apiKey || (typeof apiKey === "string" && apiKey.trim() === "")) &&
      (!baseUrl || (typeof baseUrl === "string" && baseUrl.trim() === ""))
    );
  }
  return false;
}

/** Antigravity 卡片直接显示当前模型，省得进编辑才知道。 */
function extractAgyModel(provider: Provider): string | null {
  const config = provider.settingsConfig as Record<string, any>;
  const model = config?.config?.model?.name;
  if (typeof model === "string" && model.trim()) return model.trim();
  const envModel = config?.env?.GEMINI_MODEL;
  return typeof envModel === "string" && envModel.trim()
    ? envModel.trim()
    : null;
}

const extractApiUrl = (provider: Provider, fallbackText: string) => {
  if (provider.notes?.trim()) {
    return provider.notes.trim();
  }

  if (provider.websiteUrl) {
    return provider.websiteUrl;
  }

  return extractProviderBaseUrl(provider.settingsConfig) ?? fallbackText;
};

export function ProviderCard({
  provider,
  appId,
  presentation,
  isCurrent,
  isInConfig = true,
  onEdit,
  onDelete,
  onConfigureUsage,
  onOpenWebsite,
  onDuplicate,
  onTest,
  onOpenTerminal,
  isTesting,
  dragHandleProps,
}: ProviderCardProps) {
  const { t } = useTranslation();
  const codexOfficialIdentity = resolveCodexOfficialIdentity(appId, provider);
  const managedCodexAccountId = resolveManagedAccountId(
    provider.meta,
    "codex_oauth",
  )?.trim();
  const {
    data: codexAuthStatus,
    isSuccess: isCodexAuthStatusSuccess,
    isError: isCodexAuthStatusError,
  } = useQuery({
    queryKey: ["managed-auth-status", "codex_oauth"],
    queryFn: () => authApi.authGetStatus("codex_oauth"),
    enabled:
      codexOfficialIdentity === "managed_account" &&
      Boolean(managedCodexAccountId),
    staleTime: 30_000,
  });
  const managedCodexAccount = codexAuthStatus?.accounts.find(
    (account) => account.id === managedCodexAccountId,
  );
  const manualNote = provider.notes?.trim() || undefined;
  const providerNameIncludesAccountLogin = Boolean(
    managedCodexAccount?.login &&
      (provider.name.trim() === managedCodexAccount.login ||
        provider.name.trim() ===
          `OpenAI Official (${managedCodexAccount.login})`),
  );

  const { data: health } = useProviderHealth(
    provider.id,
    appId,
    Boolean(presentation.showHealth) && isProxyAppId(appId),
  );

  const fallbackUrlText = t("provider.notConfigured", {
    defaultValue: "未配置接口地址",
  });

  const displayUrl = useMemo(() => {
    return extractApiUrl(provider, fallbackUrlText);
  }, [provider, fallbackUrlText]);

  const agyModel = useMemo(
    () => (appId === "agy" ? extractAgyModel(provider) : null),
    [appId, provider],
  );

  const isClickableUrl = useMemo(() => {
    if (provider.notes?.trim()) {
      return false;
    }
    if (displayUrl === fallbackUrlText) {
      return false;
    }
    return true;
  }, [provider.notes, displayUrl, fallbackUrlText]);

  const isBoundCodexOfficial = codexOfficialIdentity === "managed_account";
  const usageEnabled =
    provider.meta?.usage_script?.enabled ?? isBoundCodexOfficial;
  const isOfficial = isOfficialProvider(provider, appId);
  const supportsOfficialSubscription =
    isOfficial &&
    ["claude", "codex", "gemini", "grokbuild", "agy"].includes(appId);
  const isOfficialSubscriptionUsage =
    provider.meta?.usage_script?.templateType ===
    TEMPLATE_TYPES.OFFICIAL_SUBSCRIPTION;
  const officialSubscriptionEnabled =
    supportsOfficialSubscription && usageEnabled && isOfficialSubscriptionUsage;

  const isCopilot =
    provider.meta?.providerType === PROVIDER_TYPES.GITHUB_COPILOT ||
    provider.meta?.usage_script?.templateType === "github_copilot";
  const isCodexOauth =
    appId === "codex"
      ? isBoundCodexOfficial
      : provider.meta?.providerType === PROVIDER_TYPES.CODEX_OAUTH;
  // xAI OAuth (SuperGrok 反代)：额度经自管 OAuth token 自动显示，与 codex_oauth 同构
  const isXaiOauth = provider.meta?.providerType === PROVIDER_TYPES.XAI_OAUTH;
  // Antigravity 官方卡绑了授权中心的账号：额度查绑定的号（只有 macOS 能切号，其他平台忽略绑定）
  const agyBoundAccountId =
    appId === "agy" && isOfficial && isMac()
      ? resolveManagedAccountId(provider.meta, "agy_oauth")?.trim() || null
      : null;
  // 获取用量数据以判断是否有多套餐
  // 累加模式应用：使用 isInConfig 代替 isCurrent
  const shouldAutoQuery = isAdditiveAppId(appId) ? isInConfig : isCurrent;
  const autoQueryInterval = shouldAutoQuery
    ? provider.meta?.usage_script?.autoQueryInterval || 0
    : 0;

  // 脚本用量只在「已启用 + 非官方 + 非官方订阅模板」时才查询；展开判定必须复用同一谓词，
  // 因为禁用的 React Query observer 仍会返回同 key 的旧缓存。
  const scriptUsageActive =
    usageEnabled && !isOfficial && !isOfficialSubscriptionUsage;
  const { data: usage } = useUsageQuery(provider.id, appId, {
    enabled: scriptUsageActive,
    autoQueryInterval,
  });

  const isTokenPlan =
    provider.meta?.usage_script?.templateType === "token_plan";
  // 官方订阅的额度窗口不能按普通多套餐展开；缓存残留的旧脚本结果同样不认。
  const hasMultiplePlans =
    scriptUsageActive &&
    !isTokenPlan &&
    usage?.success &&
    usage.data &&
    usage.data.length > 1;

  const [isExpanded, setIsExpanded] = useState(false);
  const expandLabel = isExpanded
    ? t("usage.collapse", { defaultValue: "收起" })
    : t("usage.expand", { defaultValue: "展开" });

  useEffect(() => {
    if (hasMultiplePlans) {
      setIsExpanded(true);
    }
  }, [hasMultiplePlans]);

  const handleOpenWebsite = () => {
    if (!isClickableUrl) {
      return;
    }
    onOpenWebsite(displayUrl);
  };
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border p-4 transition-all duration-300 bg-card text-card-foreground group",
        presentation.hoverTone === "route" ||
          presentation.tone === "route" ||
          presentation.tone === "stack"
          ? "hover:border-emerald-500/50"
          : "hover:border-border-active",
        presentation.tone && TONE_CLASS[presentation.tone],
        !presentation.tone && "hover:shadow-sm",
        dragHandleProps?.isDragging &&
          "cursor-grabbing border-primary shadow-lg scale-105 z-10",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 bg-gradient-to-r to-transparent transition-opacity duration-500 pointer-events-none",
          presentation.tone === "route" || presentation.tone === "stack"
            ? "from-emerald-500/10"
            : "from-blue-500/10",
          presentation.tone ? "opacity-100" : "opacity-0",
        )}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {dragHandleProps ? (
            <button
              type="button"
              className={cn(
                "-ml-1.5 flex shrink-0 cursor-grab items-center justify-center p-1.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground active:cursor-grabbing",
                dragHandleProps.isDragging && "cursor-grabbing opacity-100",
              )}
              aria-label={t("provider.dragHandle")}
              {...dragHandleProps.attributes}
              {...dragHandleProps.listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : null}

          <div className="h-8 w-8 shrink-0 rounded-lg bg-muted flex items-center justify-center border border-border group-hover:scale-105 transition-transform duration-300">
            <ProviderIcon
              icon={resolveProviderIcon(
                appId,
                provider.icon,
                provider.iconColor,
              )}
              name={provider.name}
              color={provider.iconColor}
              size={20}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-h-7 min-w-0 flex-wrap items-center gap-2">
              <h3
                className="m-0 min-w-0 truncate text-base font-semibold leading-none text-fg-1"
                title={provider.name}
              >
                {provider.name}
              </h3>
              {presentation.chips.map((chip) => (
                <CardChipBadge key={chip.key} chip={chip} />
              ))}
              {presentation.showHealth && health && (
                <HealthChip
                  consecutiveFailures={health.consecutive_failures}
                  isHealthy={health.is_healthy}
                />
              )}
            </div>

            {codexOfficialIdentity && codexOfficialIdentity !== "api_key" ? (
              <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                {codexOfficialIdentity === "native_login" ? (
                  <span className="min-w-0 truncate" title={manualNote}>
                    {manualNote ??
                      t("codex.followCodexLoginDescription", {
                        defaultValue: "账号会随 Codex CLI 当前登录变化",
                      })}
                  </span>
                ) : managedCodexAccount ? (
                  <>
                    <span
                      className="min-w-0 truncate"
                      title={manualNote ?? managedCodexAccount.login}
                    >
                      {manualNote ??
                        (providerNameIncludesAccountLogin
                          ? t("codex.openAiAccount", {
                              defaultValue: "OpenAI 账号",
                            })
                          : managedCodexAccount.login)}
                    </span>
                    {managedCodexAccount.reauth_required && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-warning-text">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {t("codexOauth.reauthBadge", "需要重新登录")}
                      </span>
                    )}
                  </>
                ) : isCodexAuthStatusError ? (
                  <span className="inline-flex min-w-0 items-center gap-1 text-warning-text">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {t("codex.accountStatusUnavailable", {
                        defaultValue: "无法读取账号信息",
                      })}
                    </span>
                  </span>
                ) : isCodexAuthStatusSuccess ? (
                  <>
                    <span className="inline-flex min-w-0 items-center gap-1 text-sm text-warning-text">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {t("codex.boundAccountUnavailable", {
                          defaultValue: "绑定的账号不可用",
                        })}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-body font-medium text-action-text hover:underline"
                      onClick={() => onEdit(provider)}
                    >
                      {t("codex.chooseAccount", {
                        defaultValue: "选择账号",
                      })}
                    </button>
                  </>
                ) : (
                  <span className="min-w-0 truncate">
                    {t("codex.accountLoading", {
                      defaultValue: "正在加载账号…",
                    })}
                  </span>
                )}
              </div>
            ) : agyModel ? (
              <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                <span className="min-w-0 truncate" title={agyModel}>
                  {agyModel}
                </span>
              </div>
            ) : displayUrl ? (
              <button
                type="button"
                onClick={handleOpenWebsite}
                className={cn(
                  "mt-0.5 inline-flex max-w-full items-center overflow-hidden text-start text-sm",
                  isClickableUrl
                    ? "cursor-pointer text-blue-500 transition-colors underline-offset-[3px] hover:underline dark:text-blue-400"
                    : "cursor-default text-muted-foreground",
                )}
                title={displayUrl}
                disabled={!isClickableUrl}
              >
                <span className="min-w-0 truncate">{displayUrl}</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-3">
          <div className="min-w-0 max-w-full text-end">
            <div className="flex items-center justify-end gap-1">
              {isCopilot ? (
                <CopilotQuotaFooter
                  meta={provider.meta}
                  inline={true}
                  isCurrent={isCurrent}
                />
              ) : isCodexOauth ? (
                !isBoundCodexOfficial || usageEnabled ? (
                  <CodexOauthQuotaFooter
                    meta={provider.meta}
                    inline={true}
                    isCurrent={isCurrent}
                    autoQueryInterval={
                      isBoundCodexOfficial
                        ? (provider.meta?.usage_script?.autoQueryInterval ?? 5)
                        : undefined
                    }
                  />
                ) : null
              ) : isXaiOauth ? (
                <XaiOauthQuotaFooter
                  meta={provider.meta}
                  inline={true}
                  isCurrent={isCurrent}
                />
              ) : isOfficial ? (
                officialSubscriptionEnabled ? (
                  agyBoundAccountId ? (
                    <AgyAccountQuotaFooter
                      accountId={agyBoundAccountId}
                      inline={true}
                      isCurrent={isCurrent}
                      autoQueryInterval={
                        provider.meta?.usage_script?.autoQueryInterval ?? 0
                      }
                    />
                  ) : (
                    <SubscriptionQuotaFooter
                      appId={appId}
                      inline={true}
                      isCurrent={isCurrent}
                      autoQueryInterval={
                        provider.meta?.usage_script?.autoQueryInterval ?? 0
                      }
                    />
                  )
                ) : null
              ) : hasMultiplePlans ? (
                <span className="text-caption text-fg-2">
                  {t("usage.multiplePlans", {
                    count: usage?.data?.length || 0,
                    defaultValue: `${usage?.data?.length || 0} 个套餐`,
                  })}
                </span>
              ) : (
                <UsageFooter
                  provider={provider}
                  providerId={provider.id}
                  appId={appId}
                  usageEnabled={usageEnabled}
                  isCurrent={isCurrent}
                  isInConfig={isInConfig}
                  inline={true}
                />
              )}
              {hasMultiplePlans && (
                <HoverTip content={expandLabel}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpanded(!isExpanded);
                    }}
                    className="shrink-0 rounded-control p-1 text-fg-3 transition-colors hover:bg-subtle hover:text-fg-1"
                    aria-label={expandLabel}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </button>
                </HoverTip>
              )}
            </div>
          </div>
          <ProviderCardActions
            providerName={provider.name}
            presentation={presentation}
            onEdit={() => onEdit(provider)}
            onDelete={() => onDelete(provider)}
            onDuplicate={onDuplicate ? () => onDuplicate(provider) : undefined}
            onTest={
              // 连通检测对第三方/自定义/Copilot/Codex-OAuth 供应商开放。官方供应商一律不给：
              // 它们 base_url 故意留空、走客户端默认/OAuth 端点，没有可靠的探测目标。
              onTest && appId !== "mcode" && provider.category !== "official"
                ? () => onTest(provider)
                : undefined
            }
            isTesting={isTesting}
            onConfigureUsage={
              (isOfficial && !supportsOfficialSubscription) ||
              isCopilot ||
              (isCodexOauth && !isBoundCodexOfficial) ||
              isXaiOauth
                ? undefined
                : () => onConfigureUsage(provider)
            }
            onOpenTerminal={
              onOpenTerminal ? () => onOpenTerminal(provider) : undefined
            }
          />
        </div>
      </div>

      {isExpanded && hasMultiplePlans && (
        <div className="relative mt-4 border-t border-border pt-4">
          <UsageFooter
            provider={provider}
            providerId={provider.id}
            appId={appId}
            usageEnabled={usageEnabled}
            isCurrent={isCurrent}
            isInConfig={isInConfig}
            inline={false}
          />
        </div>
      )}
    </div>
  );
}
