import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { SettingsSection, View } from "@/lib/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ClassicTab = "general" | "proxy" | "auth" | "advanced" | "usage" | "about";
const SECTION_TAB: Record<SettingsSection, ClassicTab> = {
  general: "general",
  appConfig: "advanced",
  routing: "proxy",
  network: "proxy",
  data: "advanced",
  about: "about",
};
const TAB_SECTION = {
  general: "general",
  proxy: "routing",
  advanced: "data",
  about: "about",
} as const;

export function ClassicSettingsTabs({
  view,
  section,
  onSectionChange,
  onPageChange,
  children,
}: {
  view: View;
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  onPageChange: (page: "auth" | "usage") => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const value =
    view === "auth" || view === "usage" ? view : SECTION_TAB[section];
  const tabs = [
    ["general", t("settings.tabGeneral")],
    ["proxy", t("settings.tabProxy")],
    ["auth", t("settings.tabAuth")],
    ["advanced", t("settings.tabAdvanced")],
    ["usage", t("usage.title")],
    ["about", t("common.about")],
  ] as const;
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        if (next === "auth" || next === "usage") onPageChange(next);
        else onSectionChange(TAB_SECTION[next as keyof typeof TAB_SECTION]);
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="shrink-0 px-6 pb-4">
        <TabsList
          aria-label={t("settings.title")}
          className="grid w-full grid-cols-6 rounded-lg glass"
        >
          {tabs.map(([tab, label]) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="min-w-0"
              id={`classic-settings-${tab}`}
              aria-controls="classic-settings-content"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <div
        id="classic-settings-content"
        role="tabpanel"
        aria-labelledby={`classic-settings-${value}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {children}
      </div>
    </Tabs>
  );
}
