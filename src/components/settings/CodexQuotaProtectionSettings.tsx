import { useId, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SettingsFormState } from "@/hooks/useSettings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleRow } from "@/components/ui/toggle-row";
import { toast } from "@/lib/toast";

export const DEFAULT_CODEX_QUOTA_PROTECTION = {
  enabled: true,
  fiveHourThreshold: 95,
  weeklyThreshold: 98,
};

/** 阈值的输入草稿；空串保持原样，由调用方判断是否合法 */
export interface CodexQuotaThresholdDraft {
  fiveHour?: string;
  weekly?: string;
}

export const quotaConfigOf = (settings: SettingsFormState) =>
  settings.codexQuotaProtection ?? DEFAULT_CODEX_QUOTA_PROTECTION;

/** 草稿里有没有未保存的阈值改动（非法输入也算改过） */
export const hasQuotaThresholdDraft = (
  settings: SettingsFormState,
  draft: CodexQuotaThresholdDraft,
) => {
  const config = quotaConfigOf(settings);
  const fiveHour = draft.fiveHour ?? String(config.fiveHourThreshold);
  const weekly = draft.weekly ?? String(config.weeklyThreshold);
  return (
    Number(fiveHour) !== config.fiveHourThreshold ||
    Number(weekly) !== config.weeklyThreshold
  );
};

/**
 * Codex 官方额度保护（第三版小节形态）：ToggleRow 开关 + 启用后内联展开阈值
 * 输入与保存/重置，说明常驻可见（不使用「?」悬浮）。
 *
 * 阈值草稿由设置页持有：设置页按分区挂载/卸载本节，草稿留在组件里会在切分区时
 * 丢掉，只保存在本节的组件内就会违背「切页不丢输入」的契约。
 */
export function CodexQuotaProtectionSettings({
  settings,
  onChange,
  draft,
  onDraftChange,
}: {
  settings: SettingsFormState;
  onChange: (
    updates: Partial<SettingsFormState>,
  ) => void | boolean | Promise<void | boolean>;
  draft: CodexQuotaThresholdDraft;
  onDraftChange: (draft: CodexQuotaThresholdDraft) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const config = quotaConfigOf(settings);
  // Keep edits separate from optimistic settings and their possible rollback.
  const fiveHour = draft.fiveHour ?? String(config.fiveHourThreshold);
  const weekly = draft.weekly ?? String(config.weeklyThreshold);
  const [saving, setSaving] = useState(false);
  const valid = (value: string) =>
    /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 99;
  const invalid = !valid(fiveHour) || !valid(weekly);
  const dirty =
    Number(fiveHour) !== config.fiveHourThreshold ||
    Number(weekly) !== config.weeklyThreshold;
  const editDraft = (patch: CodexQuotaThresholdDraft) =>
    onDraftChange({ ...draft, ...patch });

  const save = async (next: typeof DEFAULT_CODEX_QUOTA_PROTECTION) => {
    setSaving(true);
    try {
      const saved = await onChange({ codexQuotaProtection: next });
      if (saved !== false) {
        onDraftChange({});
      }
    } catch {
      toast.error(t("notifications.saveFailedGeneric"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1">
      <ToggleRow
        icon={<ShieldAlert className="h-4 w-4 text-orange-500" />}
        title={t("settings.codexQuotaProtection.title")}
        description={t("settings.codexQuotaProtection.help")}
        checked={config.enabled}
        disabled={saving}
        onCheckedChange={(enabled) => void save({ ...config, enabled })}
      />
      {config.enabled && (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label
              htmlFor={`${id}-5h`}
              className="space-y-1 text-caption text-fg-2"
            >
              <span>{t("settings.codexQuotaProtection.fiveHour")}</span>
              <Input
                id={`${id}-5h`}
                type="number"
                min={1}
                max={99}
                step={1}
                value={fiveHour}
                disabled={saving}
                aria-invalid={!valid(fiveHour)}
                aria-describedby={`${id}-hint`}
                onChange={(event) =>
                  editDraft({ fiveHour: event.target.value })
                }
                className="w-24"
              />
            </label>
            <label
              htmlFor={`${id}-weekly`}
              className="space-y-1 text-caption text-fg-2"
            >
              <span>{t("settings.codexQuotaProtection.weekly")}</span>
              <Input
                id={`${id}-weekly`}
                type="number"
                min={1}
                max={99}
                step={1}
                value={weekly}
                disabled={saving}
                aria-invalid={!valid(weekly)}
                aria-describedby={`${id}-hint`}
                onChange={(event) => editDraft({ weekly: event.target.value })}
                className="w-24"
              />
            </label>
            <Button
              variant="solid"
              size="compact"
              disabled={saving || invalid || !dirty}
              onClick={() =>
                void save({
                  ...config,
                  fiveHourThreshold: Number(fiveHour),
                  weeklyThreshold: Number(weekly),
                })
              }
            >
              {t("settings.codexQuotaProtection.save")}
            </Button>
            <Button
              variant="outline"
              size="compact"
              disabled={saving}
              onClick={() => {
                void save({
                  ...DEFAULT_CODEX_QUOTA_PROTECTION,
                  enabled: config.enabled,
                });
              }}
            >
              {t("settings.codexQuotaProtection.reset")}
            </Button>
          </div>
          <p
            id={`${id}-hint`}
            className="text-caption text-fg-2"
            role={invalid ? "alert" : undefined}
          >
            {t(
              invalid
                ? "settings.codexQuotaProtection.invalid"
                : "settings.codexQuotaProtection.hint",
            )}
          </p>
        </div>
      )}
    </div>
  );
}
