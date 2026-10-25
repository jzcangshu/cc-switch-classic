import { useTranslation } from "react-i18next";
import { MonitorUp } from "lucide-react";
import type {
  ResolvedDirectories,
  SettingsFormState,
} from "@/hooks/useSettings";
import type { Settings } from "@/types";
import {
  DirectoryInput,
  type DirectoryAppId,
} from "@/components/settings/DirectorySettings";
import { ToggleRow } from "@/components/ui/toggle-row";
import {
  SettingsCard,
  SettingsRow,
} from "@/components/settings/SettingsLayout";

const DIRECTORY_FIELD: Record<DirectoryAppId, keyof Settings> = {
  claude: "claudeConfigDir",
  codex: "codexConfigDir",
  gemini: "geminiConfigDir",
  grokbuild: "grokConfigDir",
  opencode: "opencodeConfigDir",
  openclaw: "openclawConfigDir",
  hermes: "hermesConfigDir",
  pi: "piConfigDir",
};

const DIRECTORY_LABEL: Record<DirectoryAppId, string> = {
  claude: "settings.claudeConfigDir",
  codex: "settings.codexConfigDir",
  gemini: "settings.geminiConfigDir",
  grokbuild: "settings.grokConfigDir",
  opencode: "settings.opencodeConfigDir",
  openclaw: "settings.openclawConfigDir",
  hermes: "settings.hermesConfigDir",
  pi: "settings.piConfigDir",
};

const DIRECTORY_PLACEHOLDER: Record<DirectoryAppId, string> = {
  claude: "settings.browsePlaceholderClaude",
  codex: "settings.browsePlaceholderCodex",
  gemini: "settings.browsePlaceholderGemini",
  grokbuild: "settings.browsePlaceholderGrok",
  opencode: "settings.browsePlaceholderOpencode",
  openclaw: "settings.browsePlaceholderOpenclaw",
  hermes: "settings.browsePlaceholderHermes",
  pi: "settings.browsePlaceholderPi",
};

const DIRECTORY_APPS: DirectoryAppId[] = [
  "claude",
  "codex",
  "gemini",
  "grokbuild",
  "opencode",
  "openclaw",
  "hermes",
  "pi",
];

interface AppConfigSectionProps {
  settings: SettingsFormState;
  resolvedDirs: ResolvedDirectories;
  /** CC Switch 数据目录草稿；与下面八个目录一起点底部「保存」才写入 */
  appConfigDir?: string;
  onAutoSave: (updates: Partial<SettingsFormState>) => Promise<boolean>;
  onAppConfigChange: (value?: string) => void;
  onBrowseAppConfig: () => Promise<void>;
  onResetAppConfig: () => Promise<void>;
  onDirectoryChange: (app: DirectoryAppId, value?: string) => void;
  onBrowseDirectory: (app: DirectoryAppId) => Promise<void>;
  onResetDirectory: (app: DirectoryAppId) => Promise<void>;
}

/**
 * 设置 → 应用配置（第三版紧凑单列）：「CC Switch 配置目录」一张卡 +
 * 「配置目录覆盖（高级）」一列 8 行紧凑输入；目录改动点底部「保存」才写入。
 * Claude 目录行保留第四版的两个插件开关（附加开关行）。
 */
export function AppConfigSection({
  settings,
  resolvedDirs,
  appConfigDir,
  onAutoSave,
  onAppConfigChange,
  onBrowseAppConfig,
  onResetAppConfig,
  onDirectoryChange,
  onBrowseDirectory,
  onResetDirectory,
}: AppConfigSectionProps) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsCard>
        <SettingsRow
          label={t("settings.appConfigDir")}
          help={{
            title: t("settings.appConfigDir"),
            body: t("settings.appConfigDirDescription"),
          }}
        >
          <DirectoryInput
            label=""
            value={appConfigDir}
            resolvedValue={resolvedDirs.appConfig}
            placeholder={t("settings.browsePlaceholderApp")}
            onChange={onAppConfigChange}
            onBrowse={onBrowseAppConfig}
            onReset={onResetAppConfig}
          />
        </SettingsRow>
      </SettingsCard>

      <section className="space-y-3">
        <header className="space-y-1">
          <h3 className="text-sm font-medium">
            {t("settings.configDirectoryOverride")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("settings.configDirectoryDescription")}
          </p>
        </header>

        {DIRECTORY_APPS.map((app) => (
          <div key={app} id={`app-config-${app}`} className="space-y-2">
            <DirectoryInput
              label={t(DIRECTORY_LABEL[app])}
              value={
                settings[DIRECTORY_FIELD[app] as keyof SettingsFormState] as
                  | string
                  | undefined
              }
              resolvedValue={resolvedDirs[app]}
              placeholder={t(DIRECTORY_PLACEHOLDER[app])}
              onChange={(value) => onDirectoryChange(app, value)}
              onBrowse={() => onBrowseDirectory(app)}
              onReset={() => onResetDirectory(app)}
            />
            {app === "claude" && (
              <div className="space-y-2">
                <ToggleRow
                  icon={<MonitorUp className="h-4 w-4 text-cyan-500" />}
                  title={t("settings.enableClaudePluginIntegration")}
                  description={t(
                    "settings.enableClaudePluginIntegrationDescription",
                  )}
                  checked={!!settings.enableClaudePluginIntegration}
                  onCheckedChange={(value) =>
                    void onAutoSave({ enableClaudePluginIntegration: value })
                  }
                />
                <ToggleRow
                  icon={<MonitorUp className="h-4 w-4 text-purple-500" />}
                  title={t("settings.skipClaudeOnboarding")}
                  description={t("settings.skipClaudeOnboardingDescription")}
                  checked={!!settings.skipClaudeOnboarding}
                  onCheckedChange={(value) =>
                    void onAutoSave({ skipClaudeOnboarding: value })
                  }
                />
              </div>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
