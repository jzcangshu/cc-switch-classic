import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProviderIcon } from "@/components/ProviderIcon";
import type { SettingsFormState } from "@/hooks/useSettings";
import type { VisibleApps } from "@/types";
import type { AppId } from "@/lib/api";
import { APP_IDS, DEFAULT_VISIBLE_APPS } from "@/config/appConfig";

interface AppVisibilitySettingsProps {
  settings: SettingsFormState;
  onChange: (updates: Partial<SettingsFormState>) => void;
}

/**
 * 每个应用的图标和名称。用 Record<AppId, …> 而不是手写数组：新增应用时
 * TypeScript 会强制在这里补上，设置里的开关就不会悄悄漏掉新应用。
 */
const APP_META: Record<AppId, { icon: string; nameKey: string }> = {
  claude: { icon: "claude", nameKey: "apps.claudeCode" },
  "claude-desktop": { icon: "claude", nameKey: "apps.claudeDesktop" },
  codex: { icon: "openai", nameKey: "apps.codex" },
  gemini: { icon: "gemini", nameKey: "apps.gemini" },
  grokbuild: { icon: "grok", nameKey: "apps.grokbuild" },
  opencode: { icon: "opencode", nameKey: "apps.opencode" },
  openclaw: { icon: "openclaw", nameKey: "apps.openclaw" },
  hermes: { icon: "hermes", nameKey: "apps.hermes" },
  pi: { icon: "pi", nameKey: "apps.pi" },
  mcode: { icon: "minimax", nameKey: "apps.mcode" },
  kimi: { icon: "kimi", nameKey: "apps.kimi" },
  agy: { icon: "antigravity", nameKey: "apps.agy" },
  omp: { icon: "omp", nameKey: "apps.omp" },
};

const APP_CONFIG = APP_IDS.map((id) => ({ id, ...APP_META[id] }));

export function AppVisibilitySettings({
  settings,
  onChange,
}: AppVisibilitySettingsProps) {
  const { t } = useTranslation();

  const visibleApps: VisibleApps = {
    ...DEFAULT_VISIBLE_APPS,
    ...settings.visibleApps,
  };

  // Count how many apps are currently visible
  const visibleCount = Object.values(visibleApps).filter(Boolean).length;

  const handleToggle = (appId: AppId) => {
    const isCurrentlyVisible = visibleApps[appId];
    // Prevent disabling the last visible app
    if (isCurrentlyVisible && visibleCount <= 1) return;

    onChange({
      visibleApps: {
        ...visibleApps,
        [appId]: !isCurrentlyVisible,
      },
    });
  };

  return (
    <section className="space-y-2">
      <header className="space-y-1">
        <h3 className="text-sm font-medium">
          {t("settings.appVisibility.title")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("settings.appVisibility.description")}
        </p>
      </header>
      <div className="flex flex-wrap gap-1 rounded-md border border-border bg-background p-1">
        {APP_CONFIG.map((app) => {
          const isVisible = visibleApps[app.id];
          // Disable button if this is the last visible app
          const isDisabled = isVisible && visibleCount <= 1;

          return (
            <AppButton
              key={app.id}
              active={isVisible}
              disabled={isDisabled}
              onClick={() => handleToggle(app.id)}
              icon={app.icon}
              name={t(app.nameKey)}
            >
              {t(app.nameKey)}
            </AppButton>
          );
        })}
      </div>
    </section>
  );
}

interface AppButtonProps {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: string;
  name: string;
  children: React.ReactNode;
}

function AppButton({
  active,
  disabled,
  onClick,
  icon,
  name,
  children,
}: AppButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      size="sm"
      variant={active ? "default" : "ghost"}
      className={cn(
        "min-w-[90px] w-auto gap-1.5 px-3",
        active
          ? "shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      <ProviderIcon icon={icon} name={name} size={14} />
      {children}
    </Button>
  );
}
