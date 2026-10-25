import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  Github,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { getVersion } from "@tauri-apps/api/app";
import { settingsApi } from "@/lib/api";
import { useUpdate } from "@/contexts/UpdateContext";
import { Badge } from "@/components/ui/badge";
import { WhatsNewDialog } from "@/components/WhatsNewDialog";
import { WHATS_NEW_ENTRIES, entriesUpTo } from "@/lib/whatsNew";
import ccswitchLogo from "@/assets/icons/logo.svg";
import { extractErrorMessage } from "@/utils/errorUtils";
import { REPO_URL, RELEASES_URL } from "@/lib/repo";
import { CLASSIC_VERSION } from "@/lib/classicVersion";
import { AppsPage } from "@/components/apps/AppsPage";

// 仓库与版本常量统一来自 lib/repo.ts 与 lib/classicVersion.ts

interface AboutSectionProps {
  isPortable: boolean;
}

// 应用自身版本（getVersion，本地毫秒级、无网络）也缓存一份，纯为重挂时免去 loading 闪烁。
let appVersionCache: string | null = null;

/**
 * 设置 → 关于：第三版版式（标题 + 渐变版本卡 + Star 邀请 + 按钮行）。
 * 保留第四版的近期更新弹窗、便携版更新指引与本地环境检查入口。
 */
export function AboutSection({ isPortable }: AboutSectionProps) {
  const { t } = useTranslation();
  // 惰性初始化自模块缓存：重挂时首帧即渲染上次的值，避免 loading 闪烁；首次挂载缓存
  // 为空则回退到原始初值（null / loading）。
  const [version, setVersion] = useState<string | null>(() => appVersionCache);
  const [isLoadingVersion, setIsLoadingVersion] = useState(
    () => appVersionCache === null,
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const recentEntries = useMemo(
    () => entriesUpTo(WHATS_NEW_ENTRIES, CLASSIC_VERSION),
    [] as const,
  );

  const { hasUpdate, updateInfo, checkUpdate, resetDismiss, isChecking } =
    useUpdate();

  useEffect(() => {
    let active = true;
    const loadAppVersion = async () => {
      try {
        const appVersion = await getVersion();
        appVersionCache = appVersion;
        if (active) {
          setVersion(appVersion);
        }
      } catch (error) {
        console.error("[AboutSection] Failed to load app version", error);
        if (active) {
          setVersion(null);
        }
      } finally {
        if (active) {
          setIsLoadingVersion(false);
        }
      }
    };

    void loadAppVersion();
    return () => {
      active = false;
    };
  }, []);

  const handleOpenReleaseNotes = useCallback(async () => {
    try {
      const targetVersion = updateInfo?.availableVersion ?? version ?? "";
      const displayVersion = targetVersion.startsWith("v")
        ? targetVersion
        : targetVersion
          ? `v${targetVersion}`
          : "";

      await settingsApi.openExternal(
        displayVersion ? `${RELEASES_URL}/tag/${displayVersion}` : RELEASES_URL,
      );
    } catch (error) {
      console.error("[AboutSection] Failed to open release notes", error);
      toast.error(t("settings.openReleaseNotesFailed"));
    }
  }, [t, updateInfo?.availableVersion, version]);

  const handleOpenGithub = useCallback(() => {
    void settingsApi.openExternal(REPO_URL);
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    if (hasUpdate) {
      if (isPortable) {
        try {
          await settingsApi.openPortableUpdateDownload(
            updateInfo?.availableVersion ?? "",
          );
        } catch (error) {
          console.error("[AboutSection] Portable update failed", error);
        }
        return;
      }

      setIsDownloading(true);
      try {
        resetDismiss();
        const installed = await settingsApi.installUpdateAndRestart();
        if (!installed) {
          toast.success(t("settings.upToDate"), { closeButton: true });
        }
      } catch (error) {
        console.error("[AboutSection] Update failed", error);
        toast.error(t("settings.updateFailed"), {
          description: extractErrorMessage(error) || undefined,
          closeButton: true,
        });
        try {
          await settingsApi.checkUpdates();
        } catch (fallbackError) {
          console.error(
            "[AboutSection] Failed to open fallback updater",
            fallbackError,
          );
        }
      } finally {
        setIsDownloading(false);
      }
      return;
    }

    try {
      const available = await checkUpdate();
      if (!available) {
        toast.success(t("settings.upToDate"), { closeButton: true });
      }
    } catch (error) {
      console.error("[AboutSection] Check update failed", error);
      toast.error(t("settings.checkUpdateFailed"), {
        description: extractErrorMessage(error) || undefined,
        closeButton: true,
      });
    }
  }, [
    checkUpdate,
    hasUpdate,
    isPortable,
    resetDismiss,
    t,
    updateInfo?.availableVersion,
  ]);

  const displayVersion = version ?? t("common.unknown");

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h3 className="text-sm font-medium">{t("common.about")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("settings.aboutHint")}
        </p>
      </header>

      <div className="space-y-5 rounded-panel border border-border bg-gradient-to-br from-surface to-transparent p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <img
                  src={ccswitchLogo}
                  alt="CC Switch"
                  className="h-5 w-5"
                  draggable={false}
                />
                <h4 className="text-lg font-semibold text-fg-1">
                  CC Switch Classic
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5 bg-surface/80">
                  <span className="text-fg-2">{t("common.version")}</span>
                  <span className="font-medium tabular-nums">
                    v{CLASSIC_VERSION}
                  </span>
                </Badge>
                <Badge variant="outline" className="gap-1.5 bg-surface/80">
                  <span className="text-fg-2">{t("settings.coreVersion")}</span>
                  {isLoadingVersion ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <span className="font-medium tabular-nums">{`v${displayVersion}`}</span>
                  )}
                </Badge>
                {isPortable && (
                  <Badge variant="secondary" className="gap-1.5">
                    <Info className="h-3 w-3" />
                    {t("settings.portableMode")}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <p className="min-w-0 flex-1 text-xs leading-relaxed sm:text-right">
            <button
              type="button"
              onClick={handleOpenGithub}
              className="font-medium text-primary hover:underline"
            >
              {t("settings.starPrompt")}
            </button>
            <span aria-hidden="true" className="ml-1.5">
              👉
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="neutral"
              size="compact"
              onClick={handleOpenGithub}
            >
              <Github className="h-3.5 w-3.5" />
              {t("settings.github")}
              <span
                aria-hidden="true"
                className="inline-block animate-[spin_4s_linear_infinite] motion-reduce:animate-none"
              >
                ⭐
              </span>
            </Button>
            <Button
              type="button"
              variant="neutral"
              size="compact"
              onClick={handleOpenReleaseNotes}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("settings.releaseNotes")}
            </Button>
            {recentEntries.length > 0 && (
              <Button
                type="button"
                variant="neutral"
                size="compact"
                onClick={() => setWhatsNewOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t("whatsNew.recentTitle")}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1 text-body">
            {hasUpdate && updateInfo && (
              <>
                <p className="font-medium text-fg-1">
                  {t("settings.updateAvailable", {
                    version: updateInfo.availableVersion,
                  })}
                </p>
                {updateInfo.notes && (
                  <p className="line-clamp-3 text-fg-2">{updateInfo.notes}</p>
                )}
                {isPortable && (
                  <p className="text-fg-2">
                    {t("settings.portableUpdateHint")}
                  </p>
                )}
              </>
            )}
          </div>
          <Button
            type="button"
            variant={hasUpdate ? "solid" : "neutral"}
            size="regular"
            onClick={handleCheckUpdate}
            disabled={isChecking || isDownloading}
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("settings.updating")}
              </>
            ) : hasUpdate ? (
              <>
                <Download className="h-3.5 w-3.5" />
                {t("settings.updateTo", {
                  version: updateInfo?.availableVersion ?? "",
                })}
              </>
            ) : isChecking ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                {t("settings.checking")}
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                {t("settings.checkForUpdates")}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 本地环境检查（第三版形态）：应用安装与升级管理直接内嵌在本页 */}
      <section className="rounded-panel border border-border">
        <div className="px-5 pt-4">
          <h3 className="m-0 text-sm font-medium">
            {t("settings.localEnvCheck")}
          </h3>
          <p className="mb-2 text-xs text-muted-foreground">
            {t("settings.oneClickInstallHint")}
          </p>
        </div>
        <AppsPage embedded />
      </section>

      <WhatsNewDialog
        open={whatsNewOpen}
        onClose={() => setWhatsNewOpen(false)}
        entries={recentEntries}
      />
    </div>
  );
}
