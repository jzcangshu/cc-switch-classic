import { useState } from "react";
import { RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  useAcknowledgeCodexStaleClients,
  useRestartCodexAppServerDaemon,
} from "@/lib/query/proxy";
import type { CodexStaleClients } from "@/types/proxy";

// 只保存在本机的提醒偏好；不影响后端检测、账号配置或已检测到的旧进程。
const HIDE_UNVERIFIED_KEY = "ccswitch:codex:hideUnverifiedStaleNotice";

function readHideUnverified(): boolean {
  try {
    return localStorage.getItem(HIDE_UNVERIFIED_KEY) === "1";
  } catch {
    return false;
  }
}

interface CodexStaleClientsNoticeProps {
  staleClients: CodexStaleClients;
  onDismiss?: () => void;
}

/**
 * Codex 客户端可能缓存着旧账号或模型列表（模型目录只在启动时读，切换账号或直连、路由、聚合
 * 模式后都会变）。命令行连的守护进程确认后一键重启；桌面版、编辑器插件只提示用户彻底退出再
 * 开。重启会中断守护进程里正在运行的任务，执行期间确认框保持打开。看不到桌面版、编辑器插件
 * 进程时只作普通提醒：关闭只确认本次，也可明确选择不再显示这类推测；已检测到的旧进程仍提醒。
 */
export function CodexStaleClientsNotice({
  staleClients,
  onDismiss,
}: CodexStaleClientsNoticeProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [hideUnverified, setHideUnverified] = useState(readHideUnverified);
  const restart = useRestartCodexAppServerDaemon();
  const acknowledge = useAcknowledgeCodexStaleClients();
  const showUnverified = Boolean(staleClients.unverified && !hideUnverified);
  const showOthers =
    staleClients.others && (!staleClients.unverified || showUnverified);
  const onlyUnverified = showUnverified && !staleClients.daemon;
  const muteUnverified = () => {
    try {
      localStorage.setItem(HIDE_UNVERIFIED_KEY, "1");
    } catch {
      // 本地存储不可用时，仍允许在当前页面内静音。
    }
    setHideUnverified(true);
  };
  const dismiss = () => {
    if (staleClients.unverified) acknowledge.mutate();
    onDismiss?.();
  };

  if (!staleClients.daemon && !showOthers) return null;

  return (
    <>
      <Notice
        tone={onlyUnverified ? "neutral" : "warning"}
        title={t(
          onlyUnverified
            ? "proxy.stackMode.codexStale.unverifiedTitle"
            : staleClients.auth
              ? "proxy.stackMode.codexStale.authTitle"
              : "proxy.stackMode.codexStale.title",
        )}
        onDismiss={onDismiss || staleClients.unverified ? dismiss : undefined}
        dismissLabel={t("common.close")}
        actions={
          staleClients.daemon ? (
            <Button
              variant="neutral"
              size="compact"
              disabled={restart.isPending}
              onClick={() => setConfirming(true)}
            >
              <RotateCw
                className={`h-3.5 w-3.5 ${restart.isPending ? "animate-spin" : ""}`}
              />
              {t("proxy.stackMode.codexStale.restart")}
            </Button>
          ) : undefined
        }
      >
        {staleClients.daemon && (
          <span className="block">
            {t("proxy.stackMode.codexStale.daemon")}
          </span>
        )}
        {showOthers && (
          <span className="block">
            {t("proxy.stackMode.codexStale.others")}
          </span>
        )}
        {showUnverified && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{t("proxy.stackMode.codexStale.unverifiedHint")}</span>
            <button
              type="button"
              className="min-h-6 rounded-sm text-fg-1 underline underline-offset-4 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={muteUnverified}
            >
              {t("proxy.stackMode.codexStale.hideUnverified")}
            </button>
          </div>
        )}
      </Notice>
      <ConfirmDialog
        isOpen={confirming}
        title={t("proxy.stackMode.codexStale.confirmTitle")}
        message={t("proxy.stackMode.codexStale.confirmMessage")}
        confirmText={t("proxy.stackMode.codexStale.confirm")}
        pending={restart.isPending}
        onConfirm={() =>
          restart.mutate(undefined, {
            onSettled: () => setConfirming(false),
          })
        }
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
