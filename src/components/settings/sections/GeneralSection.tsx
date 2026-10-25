import { useTranslation } from "react-i18next";
import {
  AppWindow,
  ArrowLeftRight,
  EyeOff,
  Monitor,
  Moon,
  Power,
  Sun,
} from "lucide-react";
import type { SettingsFormState } from "@/hooks/useSettings";
import { useTheme } from "@/components/theme-provider";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { ToggleRow } from "@/components/ui/toggle-row";
import { isLinux } from "@/lib/platform";
import { AppVisibilitySettings } from "@/components/settings/AppVisibilitySettings";
import { TerminalSelect } from "@/components/settings/TerminalSettings";
import { SkillsStorageSettings } from "@/components/skills/SkillsStorageSheet";
import { CodexAuthSettings } from "@/components/settings/CodexAuthSettings";
import type { SkillStorageLocation } from "@/types";
import {
  SettingsBlock,
  SettingsCard,
  SettingsSwitchRow,
} from "@/components/settings/SettingsLayout";

type Language = SettingsFormState["language"];

const LANGUAGES: { value: Language; labelKey: string }[] = [
  { value: "zh", labelKey: "settings.languageOptionChinese" },
  { value: "zh-TW", labelKey: "settings.languageOptionTraditionalChinese" },
  { value: "en", labelKey: "settings.languageOptionEnglish" },
  { value: "ja", labelKey: "settings.languageOptionJapanese" },
  { value: "tr", labelKey: "settings.languageOptionTurkish" },
];

interface GeneralSectionProps {
  settings: SettingsFormState;
  onAutoSave: (updates: Partial<SettingsFormState>) => Promise<boolean>;
  savedCodexConfigDir?: string;
  onStorageMigrated: (location: SkillStorageLocation) => void;
}

/**
 * 通用设置（第三版小节形态）：小节标题 + 灰色说明 + 控件。
 * 语言、主题恢复横排按钮组；额度显示并入外观小节；托盘样式保留第四版新增。
 */
export function GeneralSection({
  settings,
  onAutoSave,
  savedCodexConfigDir,
  onStorageMigrated,
}: GeneralSectionProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <>
      {/* 界面语言 */}
      <section className="space-y-2">
        <header className="space-y-1">
          <h3 className="text-sm font-medium">{t("settings.language")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("settings.languageHint")}
          </p>
        </header>
        <div className="inline-flex flex-wrap gap-1 rounded-md border border-border bg-background p-1">
          {LANGUAGES.map((language) => (
            <Button
              key={language.value}
              type="button"
              size="sm"
              variant={
                settings.language === language.value ? "default" : "ghost"
              }
              aria-pressed={settings.language === language.value}
              onClick={() => void onAutoSave({ language: language.value })}
              className="min-w-[96px]"
            >
              {t(language.labelKey)}
            </Button>
          ))}
        </div>
      </section>

      {/* 外观主题（额度显示并入本小节） */}
      <section className="space-y-2">
        <header className="space-y-1">
          <h3 className="text-sm font-medium">{t("settings.theme")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("settings.themeHint")}
          </p>
        </header>
        <div
          role="group"
          aria-label={t("settings.theme")}
          className="inline-flex flex-wrap gap-1 rounded-md border border-border bg-background p-1"
        >
          {(
            [
              {
                value: "light",
                label: t("settings.themeLight"),
                icon: Sun,
              },
              {
                value: "dark",
                label: t("settings.themeDark"),
                icon: Moon,
              },
              {
                value: "system",
                label: t("settings.themeSystem"),
                icon: Monitor,
              },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={theme === value ? "default" : "ghost"}
              aria-pressed={theme === value}
              className="min-w-[96px]"
              onClick={() => setTheme(value)}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {t("settings.general.quotaDisplay")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("settings.general.quotaDisplayHelp")}
            </p>
          </div>
          <SegmentedControl
            size="sm"
            aria-label={t("settings.general.quotaDisplay")}
            value={settings.quotaDisplay ?? "used"}
            onValueChange={(value) => void onAutoSave({ quotaDisplay: value })}
            items={[
              {
                value: "left",
                label: t("settings.general.quotaDisplayLeft"),
              },
              {
                value: "used",
                label: t("settings.general.quotaDisplayUsed"),
              },
            ]}
          />
        </div>
      </section>

      {/* 页头与应用管理 */}
      <section className="space-y-2">
        <header className="space-y-1">
          <h3 className="text-sm font-medium">
            {t("settings.general.sidebarAndHeader")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("settings.general.sidebarAndHeaderDescription")}
          </p>
        </header>
        <div className="space-y-3">
          <ToggleRow
            icon={<ArrowLeftRight className="h-4 w-4 text-blue-500" />}
            title={t("settings.appVisibility.showProfileSwitcher")}
            description={t(
              "settings.appVisibility.showProfileSwitcherDescription",
            )}
            checked={settings.showProfileSwitcher ?? false}
            onCheckedChange={(value) =>
              void onAutoSave({ showProfileSwitcher: value })
            }
          />
          <AppVisibilitySettings
            settings={settings}
            onChange={(updates) => void onAutoSave(updates)}
          />
        </div>
      </section>

      <SettingsCard className="p-4">
        <SkillsStorageSettings
          inline
          settings={settings}
          onChange={onAutoSave}
          onMigrated={onStorageMigrated}
        />
      </SettingsCard>

      <CodexAuthSettings
        settings={settings}
        onChange={onAutoSave}
        codexConfigDir={savedCodexConfigDir}
      />

      <SettingsBlock title={t("settings.general.updates")}>
        <SettingsCard>
          <SettingsSwitchRow
            label={t("settings.general.checkToolUpdates")}
            help={{
              title: t("settings.general.checkToolUpdates"),
              body: t("settings.general.checkToolUpdatesHelp"),
            }}
            checked={settings.checkToolUpdatesOnStartup ?? false}
            onCheckedChange={(value) =>
              void onAutoSave({ checkToolUpdatesOnStartup: value })
            }
          />
        </SettingsCard>
      </SettingsBlock>

      {/* 窗口与终端（托盘样式是第四版新增，保留） */}
      <section className="space-y-2">
        <header className="space-y-1">
          <h3 className="text-sm font-medium">
            {t("settings.general.windowAndTerminal")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("settings.general.windowAndTerminalDescription")}
          </p>
        </header>
        <div className="space-y-3">
          <ToggleRow
            icon={<Power className="h-4 w-4 text-orange-500" />}
            title={t("settings.launchOnStartup")}
            description={t("settings.launchOnStartupDescription")}
            checked={!!settings.launchOnStartup}
            onCheckedChange={(value) =>
              void onAutoSave({ launchOnStartup: value })
            }
          />
          {settings.launchOnStartup && (
            <ToggleRow
              icon={<EyeOff className="h-4 w-4 text-green-500" />}
              title={t("settings.silentStartup")}
              description={t("settings.silentStartupDescription")}
              checked={!!settings.silentStartup}
              onCheckedChange={(value) =>
                void onAutoSave({ silentStartup: value })
              }
            />
          )}
          <ToggleRow
            icon={<AppWindow className="h-4 w-4 text-blue-500" />}
            title={t("settings.minimizeToTray")}
            description={t("settings.minimizeToTrayDescription")}
            checked={settings.minimizeToTrayOnClose}
            onCheckedChange={(value) =>
              void onAutoSave({ minimizeToTrayOnClose: value })
            }
          />
          {/* Linux（AppIndicator）只能出原生菜单，没得选 */}
          {!isLinux() && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t("settings.general.trayStyle")}
                </p>
                <p className="text-xs text-fg-2">
                  {t("settings.general.trayStyleHelp")}
                </p>
              </div>
              <SegmentedControl
                size="sm"
                aria-label={t("settings.general.trayStyle")}
                value={settings.nativeTrayMenu ? "menu" : "panel"}
                onValueChange={(value) =>
                  void onAutoSave({ nativeTrayMenu: value === "menu" })
                }
                items={[
                  {
                    value: "panel",
                    label: t("settings.general.trayStylePanel"),
                  },
                  {
                    value: "menu",
                    label: t("settings.general.trayStyleMenu"),
                  },
                ]}
              />
            </div>
          )}
          {isLinux() && (
            <ToggleRow
              icon={<AppWindow className="h-4 w-4 text-amber-500" />}
              title={t("settings.useAppWindowControls")}
              description={t("settings.useAppWindowControlsDescription")}
              checked={!!settings.useAppWindowControls}
              onCheckedChange={(value) =>
                void onAutoSave({ useAppWindowControls: value })
              }
            />
          )}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {t("settings.terminal.title")}
              </p>
              <p className="text-xs text-fg-2">
                {t("settings.general.terminalHelp")}
              </p>
            </div>
            <TerminalSelect
              className="h-8 w-[160px]"
              value={settings.preferredTerminal}
              onChange={(terminal) =>
                void onAutoSave({ preferredTerminal: terminal })
              }
            />
          </div>
        </div>
      </section>
    </>
  );
}
