import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/lib/toast";
import { useSettings } from "@/hooks/useSettings";
import type { SettingsFormState } from "@/hooks/useSettings";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCcSwitchSkillsDir,
  useInstalledSkills,
  useResyncSkillsToApps,
} from "@/hooks/useSkills";
import { DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  RADIO_CLASS,
  V7ConfirmDialog,
  V7Dialog,
} from "@/components/mcp/formBits";
import { APP_DISPLAY_NAME } from "@/components/shell/AppGlyph";
import { shortenHomePath } from "@/components/sessions/utils";
import { skillsApi, type SkillAppSyncOutcome } from "@/lib/api/skills";
import type { AppId } from "@/lib/api/types";
import type { SkillStorageLocation, SkillSyncMethod } from "@/types";
import { extractErrorMessage } from "@/utils/errorUtils";

interface SkillsStorageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const appName = (app: string) => APP_DISPLAY_NAME[app as AppId] ?? app;

const DEFAULT_CC_SWITCH_DIR = "~/.cc-switch/skills";
const UNIFIED_DIR = "~/.agents/skills";

/** 和后端 SyncMethod（auto / symlink / copy）一一对应。 */
const SYNC_METHODS: {
  id: SkillSyncMethod;
  labelKey: string;
  descKey?: string;
}[] = [
  { id: "auto", labelKey: "skills.storageSheet.syncAuto" },
  {
    id: "symlink",
    labelKey: "skills.storageSheet.syncSymlink",
    descKey: "skills.storageSheet.syncSymlinkDesc",
  },
  {
    id: "copy",
    labelKey: "skills.storageSheet.syncCopy",
    descKey: "skills.storageSheet.syncCopyDesc",
  },
];

const LEGEND_CLASS = "mb-2 p-0 text-body font-semibold text-fg-1";
const RADIO_LABEL_CLASS =
  "flex cursor-pointer items-center gap-2.5 text-body text-fg-1 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60";

/** Skills 页 ⋯ →「存储与同步」对话框：主副本放在哪、怎么同步到各应用（原来在设置 → 通用）。 */
export function SkillsStorageSheet({
  open,
  onOpenChange,
}: SkillsStorageSheetProps) {
  const { t } = useTranslation();
  const { settings, updateSettings, autoSaveSettings } = useSettings();
  if (!settings) return null;
  return (
    <SkillsStorageSettings
      open={open}
      onOpenChange={onOpenChange}
      settings={settings}
      onMigrated={(target) => updateSettings({ skillStorageLocation: target })}
      onChange={async (updates) => {
        const previous = settings.skillSyncMethod;
        updateSettings(updates);
        try {
          await autoSaveSettings(updates);
          return true;
        } catch {
          updateSettings({ skillSyncMethod: previous });
          toast.error(t("settings.saveFailedGeneric"));
          return false;
        }
      }}
    />
  );
}

/** 通用设置和快捷对话框复用迁移、失败反馈，不另建设置表单状态。 */
export function SkillsStorageSettings({
  open = true,
  onOpenChange = () => undefined,
  inline = false,
  settings,
  onMigrated,
  onChange,
}: Partial<SkillsStorageSheetProps> & {
  inline?: boolean;
  settings: SettingsFormState;
  onMigrated: (target: SkillStorageLocation) => void;
  onChange: (updates: Partial<SettingsFormState>) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: installedSkills } = useInstalledSkills();
  const { data: ccSwitchDirRaw } = useCcSwitchSkillsDir(open);
  const resyncMutation = useResyncSkillsToApps();

  const location: SkillStorageLocation =
    settings?.skillStorageLocation ?? "cc_switch";
  const syncMethod: SkillSyncMethod = settings?.skillSyncMethod ?? "auto";
  const installedCount = installedSkills?.length ?? 0;
  const ccSwitchDir = ccSwitchDirRaw
    ? shortenHomePath(ccSwitchDirRaw)
    : DEFAULT_CC_SWITCH_DIR;

  // 单选只是「想换到哪」；点「移动并切换…」才真正迁移
  const [pendingLocation, setPendingLocation] =
    useState<SkillStorageLocation>(location);
  const [confirmMove, setConfirmMove] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    if (!inline || !isMigrating) return;
    const blockNavigationShortcut = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" ||
        ((event.ctrlKey || event.metaKey) && event.key === ",")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", blockNavigationShortcut, true);
    return () =>
      window.removeEventListener("keydown", blockNavigationShortcut, true);
  }, [inline, isMigrating]);

  useEffect(() => {
    if (open) setPendingLocation(location);
  }, [open, location]);

  const targetDir = pendingLocation === "unified" ? UNIFIED_DIR : ccSwitchDir;
  // 对话框里的禁用原因写成看得见的一行（HELP_BRIEF：菜单 / 对话框例外），不挂悬停气泡
  const locationUnchanged = pendingLocation === location;

  const doMigrate = async (target: SkillStorageLocation) => {
    setIsMigrating(true);
    setConfirmMove(false);
    const path = target === "unified" ? UNIFIED_DIR : ccSwitchDir;
    try {
      const result = await skillsApi.migrateStorage(target);
      if (result.errors.length > 0) {
        toast.warning(
          t("skills.storageSheet.movePartial", {
            migrated: result.migratedCount,
            errors: result.errors.length,
          }),
          { description: result.errors.join("\n"), closeButton: true },
        );
      } else {
        toast.success(
          t("skills.storageSheet.moveDone", {
            count: result.migratedCount,
            path,
          }),
          { closeButton: true },
        );
      }
      onMigrated(target);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: ["skills"] }),
      ]);
    } catch (error) {
      toast.error(t("common.error"), {
        description: extractErrorMessage(error) || String(error),
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleMove = () => {
    if (pendingLocation === location || isMigrating) return;
    // 一个 Skill 都没有时没什么可移动的，直接切换
    if (installedCount > 0) {
      setConfirmMove(true);
    } else {
      void doMigrate(pendingLocation);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await skillsApi.openCcSwitchSkillsDir();
    } catch (error) {
      toast.error(t("common.error"), {
        description: extractErrorMessage(error) || String(error),
      });
    }
  };

  const handleSyncMethod = async (method: SkillSyncMethod) => {
    if (method === syncMethod || isMigrating) return;
    await onChange({ skillSyncMethod: method });
  };

  const reportResync = (outcomes: SkillAppSyncOutcome[]) => {
    const failed = outcomes.filter((outcome) => !outcome.ok);
    if (failed.length === 0) {
      toast.success(t("skills.storageSheet.resyncDone"), { closeButton: true });
      return;
    }
    const details = failed.flatMap((outcome) =>
      outcome.error
        ? [`${appName(outcome.app)}: ${outcome.error}`]
        : outcome.failedSkills.map(
            (skill) =>
              `${appName(outcome.app)} · ${t(
                "skills.storageSheet.resyncSkillItem",
                { directory: skill.directory, error: skill.error },
              )}`,
          ),
    );
    toast.warning(
      t("skills.storageSheet.resyncPartial", {
        count: failed.length,
        apps: failed
          .map((outcome) => appName(outcome.app))
          .join(t("mcpPage.listSeparator")),
      }),
      { description: details.join("\n"), closeButton: true },
    );
  };

  const handleResync = async () => {
    if (resyncMutation.isPending) return;
    try {
      reportResync(await resyncMutation.mutateAsync());
    } catch (error) {
      toast.error(t("common.error"), {
        description: extractErrorMessage(error) || String(error),
      });
    }
  };

  const content = (
    <>
      <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
        <legend className={LEGEND_CLASS}>
          {t(
            inline
              ? "settings.skillStorage.title"
              : "skills.storageSheet.locationTitle",
          )}
        </legend>
        {inline && (
          <div
            role="group"
            aria-label={t("settings.skillStorage.title")}
            className="inline-flex w-fit flex-wrap gap-1 rounded-md border border-border bg-background p-1"
          >
            {(["cc_switch", "unified"] as const).map((target) => (
              <Button
                key={target}
                type="button"
                size="sm"
                variant={pendingLocation === target ? "default" : "ghost"}
                aria-pressed={pendingLocation === target}
                disabled={isMigrating}
                className="min-w-[96px]"
                onClick={() => setPendingLocation(target)}
              >
                {t(
                  target === "cc_switch"
                    ? "settings.skillStorage.ccSwitch"
                    : "settings.skillStorage.unified",
                )}
              </Button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          {!inline && (
            <label className={RADIO_LABEL_CLASS}>
              <input
                type="radio"
                name="skills-storage-location"
                className={RADIO_CLASS}
                checked={pendingLocation === "cc_switch"}
                disabled={isMigrating}
                aria-describedby="skills-storage-cc-path"
                onChange={() => setPendingLocation("cc_switch")}
              />
              {t("skills.storageSheet.locationCcSwitch")}
            </label>
          )}
          <div className="flex min-w-0 items-center gap-2 pl-[26px]">
            <code
              id="skills-storage-cc-path"
              className="min-w-0 truncate font-mono text-caption text-fg-2"
              title={ccSwitchDirRaw ?? ccSwitchDir}
            >
              {ccSwitchDir}
            </code>
            <button
              type="button"
              aria-label={t("skills.storageSheet.openFolderAria", {
                path: ccSwitchDir,
              })}
              onClick={() => void handleOpenFolder()}
              className="shrink-0 whitespace-nowrap text-caption font-medium text-fg-1 underline decoration-border-strong underline-offset-[3px] hover:decoration-fg-1"
            >
              {t("skills.storageSheet.openFolder")}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          {!inline && (
            <label className={RADIO_LABEL_CLASS}>
              <input
                type="radio"
                name="skills-storage-location"
                className={RADIO_CLASS}
                checked={pendingLocation === "unified"}
                disabled={isMigrating}
                aria-describedby="skills-storage-unified-warn"
                onChange={() => setPendingLocation("unified")}
              />
              <span>
                {t("skills.storageSheet.locationUnified")}{" "}
                <code className="whitespace-nowrap font-mono text-caption">
                  {UNIFIED_DIR}
                </code>
              </span>
            </label>
          )}
          {pendingLocation === "unified" && (
            <p
              id="skills-storage-unified-warn"
              className="m-0 pl-[26px] text-caption text-warning-text"
            >
              {t("skills.storageSheet.unifiedWarning")}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <p
            id="skills-storage-move-hint"
            className="m-0 min-w-0 text-caption text-fg-2"
          >
            {t("skills.storageSheet.moveHint", { count: installedCount })}
          </p>
          <Button
            type="button"
            variant="neutral"
            size="regular"
            className="shrink-0"
            disabled={isMigrating || locationUnchanged}
            aria-describedby="skills-storage-move-hint"
            onClick={handleMove}
          >
            {isMigrating && <Loader2 className="h-4 w-4 animate-spin" />}
            {isMigrating
              ? t("skills.storageSheet.moving")
              : t("skills.storageSheet.move")}
          </Button>
        </div>
      </fieldset>

      <div className="h-px bg-border" />

      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className={LEGEND_CLASS}>
          {t(
            inline
              ? "settings.skillSync.title"
              : "skills.storageSheet.syncTitle",
          )}
        </legend>
        {inline ? (
          <>
            <div
              role="group"
              aria-label={t("settings.skillSync.title")}
              className="inline-flex w-fit flex-wrap gap-1 rounded-md border border-border bg-background p-1"
            >
              {SYNC_METHODS.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={syncMethod === option.id ? "default" : "ghost"}
                  aria-pressed={syncMethod === option.id}
                  disabled={isMigrating}
                  className="min-w-[96px]"
                  onClick={() => void handleSyncMethod(option.id)}
                >
                  {t(
                    option.id === "auto"
                      ? option.labelKey
                      : `settings.skillSync.${option.id}`,
                  )}
                </Button>
              ))}
            </div>
            {SYNC_METHODS.filter(
              (option) => option.id === syncMethod && option.descKey,
            ).map((option) => (
              <p key={option.id} className="text-xs text-muted-foreground">
                {t(option.descKey!)}
              </p>
            ))}
          </>
        ) : (
          SYNC_METHODS.map((option) => (
            <label key={option.id} className={RADIO_LABEL_CLASS}>
              <input
                type="radio"
                name="skills-sync-method"
                value={option.id}
                className={RADIO_CLASS}
                checked={syncMethod === option.id}
                disabled={isMigrating}
                onChange={() => void handleSyncMethod(option.id)}
              />
              <span>
                {t(option.labelKey)}
                {option.descKey && (
                  <span className="ml-2 text-caption text-fg-2">
                    {t(option.descKey)}
                  </span>
                )}
              </span>
            </label>
          ))
        )}
        <div className="flex items-center gap-3 pt-0.5">
          <p className="m-0 min-w-0 flex-1 text-caption text-fg-2">
            {t("skills.storageSheet.resyncHint")}
          </p>
          <Button
            type="button"
            variant="neutral"
            size="compact"
            className="shrink-0"
            disabled={resyncMutation.isPending}
            onClick={() => void handleResync()}
          >
            {resyncMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            {resyncMutation.isPending
              ? t("skills.storageSheet.resyncing")
              : t("skills.storageSheet.resync")}
          </Button>
        </div>
      </fieldset>
    </>
  );

  return (
    <>
      {inline ? (
        <div className="space-y-6">{content}</div>
      ) : (
        <V7Dialog
          open={open}
          onOpenChange={(next) => {
            if (!next && isMigrating) return;
            onOpenChange(next);
          }}
          width={520}
        >
          <DialogTitle>{t("skills.storageSheet.title")}</DialogTitle>
          {content}
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="solid"
              size="regular"
              autoFocus
              disabled={isMigrating}
              onClick={() => onOpenChange(false)}
            >
              {t("common.done")}
            </Button>
          </div>
        </V7Dialog>
      )}

      {inline && (
        <V7Dialog open={isMigrating} onOpenChange={() => undefined} width={400}>
          <DialogTitle>{t("skills.storageSheet.moving")}</DialogTitle>
          <div
            role="status"
            className="flex items-center gap-3 text-sm text-muted-foreground"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            {targetDir}
          </div>
        </V7Dialog>
      )}

      <V7ConfirmDialog
        open={confirmMove}
        danger={false}
        title={t("skills.storageSheet.moveConfirmTitle", {
          count: installedCount,
          path: targetDir,
        })}
        body={t("skills.storageSheet.moveConfirmBody")}
        confirmLabel={t("skills.storageSheet.moveConfirmButton")}
        pending={isMigrating}
        onConfirm={() => void doMigrate(pendingLocation)}
        onCancel={() => setConfirmMove(false)}
      />
    </>
  );
}
