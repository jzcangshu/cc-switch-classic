import { useTranslation } from "react-i18next";
import { Monitor, Moon, Sun } from "lucide-react";
import type { SettingsFormState } from "@/hooks/useSettings";
import { useTheme } from "@/components/theme-provider";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { isLinux } from "@/lib/platform";
import { AppVisibilitySettings } from "@/components/settings/AppVisibilitySettings";
import { TerminalSelect } from "@/components/settings/TerminalSettings";
import { SkillsStorageSettings } from "@/components/skills/SkillsStorageSheet";
import { CodexAuthSettings } from "@/components/settings/CodexAuthSettings";
import type { SkillStorageLocation } from "@/types";
import {
  SettingsBlock,
  SettingsCard,
  SettingsRow,
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
      <SettingsBlock title={t("settings.general.appearance")}>
        <SettingsCard>
          <SettingsRow label={t("settings.language")}>
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
          </SettingsRow>
          <SettingsRow label={t("settings.theme")}>
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
          </SettingsRow>
          <SettingsRow
            label={t("settings.general.quotaDisplay")}
            help={{
              title: t("settings.general.quotaDisplay"),
              body: t("settings.general.quotaDisplayHelp"),
            }}
            control={
              <SegmentedControl
                size="sm"
                aria-label={t("settings.general.quotaDisplay")}
                value={settings.quotaDisplay ?? "left"}
                onValueChange={(value) =>
                  void onAutoSave({ quotaDisplay: value })
                }
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
            }
          />
        </SettingsCard>
      </SettingsBlock>

      <SettingsCard className="p-4">
        <AppVisibilitySettings
          settings={settings}
          onChange={(updates) => void onAutoSave(updates)}
        />
      </SettingsCard>
      <SettingsCard className="p-4">
        <SkillsStorageSettings
          inline
          settings={settings}
          onChange={onAutoSave}
          onMigrated={onStorageMigrated}
        />
      </SettingsCard>
      <SettingsCard>
        <CodexAuthSettings
          settings={settings}
          onChange={onAutoSave}
          codexConfigDir={savedCodexConfigDir}
        />
      </SettingsCard>

      <SettingsBlock title={t("settings.general.sidebarAndHeader")}>
        <SettingsCard>
          <SettingsSwitchRow
            label={t("settings.appVisibility.showProfileSwitcher")}
            help={{
              title: t("settings.appVisibility.showProfileSwitcher"),
              body: t("settings.appVisibility.showProfileSwitcherDescription"),
            }}
            checked={settings.showProfileSwitcher ?? false}
            onCheckedChange={(value) =>
              void onAutoSave({ showProfileSwitcher: value })
            }
          />
        </SettingsCard>
      </SettingsBlock>

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

      <SettingsBlock title={t("settings.general.windowAndTerminal")}>
        <SettingsCard>
          <SettingsSwitchRow
            label={t("settings.launchOnStartup")}
            checked={!!settings.launchOnStartup}
            onCheckedChange={(value) =>
              void onAutoSave({ launchOnStartup: value })
            }
          />
          {settings.launchOnStartup && (
            <SettingsSwitchRow
              label={t("settings.silentStartup")}
              help={{
                title: t("settings.silentStartup"),
                body: t("settings.silentStartupDescription"),
              }}
              checked={!!settings.silentStartup}
              onCheckedChange={(value) =>
                void onAutoSave({ silentStartup: value })
              }
            />
          )}
          <SettingsSwitchRow
            label={t("settings.minimizeToTray")}
            help={{
              title: t("settings.minimizeToTray"),
              body: t("settings.general.minimizeToTrayHelp"),
            }}
            checked={settings.minimizeToTrayOnClose}
            onCheckedChange={(value) =>
              void onAutoSave({ minimizeToTrayOnClose: value })
            }
          />
          {/* Linux（AppIndicator）只能出原生菜单，没得选 */}
          {!isLinux() && (
            <SettingsRow
              label={t("settings.general.trayStyle")}
              help={{
                title: t("settings.general.trayStyle"),
                body: t("settings.general.trayStyleHelp"),
              }}
              control={
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
              }
            />
          )}
          {isLinux() && (
            <SettingsSwitchRow
              label={t("settings.useAppWindowControls")}
              help={{
                title: t("settings.useAppWindowControls"),
                body: t("settings.useAppWindowControlsDescription"),
              }}
              checked={!!settings.useAppWindowControls}
              onCheckedChange={(value) =>
                void onAutoSave({ useAppWindowControls: value })
              }
            />
          )}
          <SettingsRow
            label={t("settings.terminal.title")}
            help={{
              title: t("settings.terminal.title"),
              body: t("settings.general.terminalHelp"),
            }}
            control={
              <TerminalSelect
                className="h-8 w-[160px]"
                value={settings.preferredTerminal}
                onChange={(terminal) =>
                  void onAutoSave({ preferredTerminal: terminal })
                }
              />
            }
          />
        </SettingsCard>
      </SettingsBlock>
    </>
  );
}
