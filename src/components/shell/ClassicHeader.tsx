import { useContext, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Book,
  Brain,
  Cpu,
  FolderOpen,
  History,
  KeyRound,
  Settings,
  Shield,
  Wrench,
} from "lucide-react";
import type { AppId } from "@/lib/api";
import type { VisibleApps } from "@/types";
import type { AppPage, GlobalPage } from "@/lib/navigation";
import { isMcpAppId, SKILLS_APP_IDS } from "@/config/appConfig";
import { PROMPT_APP_IDS } from "@/lib/query/prompts";
import { sharedFeatureAppOf } from "@/lib/navigation";
import { AppSwitcher } from "@/components/AppSwitcher";
import { McpIcon } from "@/components/BrandIcons";
import { RoutingActivationBrand } from "@/components/proxy/RoutingActivationBrand";
import { Button } from "@/components/ui/button";
import { HoverTip } from "@/components/ui/hover-tip";

import { WindowControlsContext } from "./AppPageHeader";
import { DRAG_REGION_ATTR, DRAG_REGION_STYLE } from "@/lib/platform";

const NO_DRAG = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

interface ClassicHeaderProps {
  activeApp: AppId;
  /** 品牌字动效：当前应用是否处于路由接管 */
  brandActive: boolean;
  /** 品牌字动效：路由状态是否已加载（避免首帧误判） */
  brandReady: boolean;
  visibleApps: VisibleApps;
  onSelectApp: (app: AppId) => void;
  onSelectPage: (page: GlobalPage | "settings") => void;
  onSelectAppPage: (page: AppPage) => void;
  onOpenClawConfig: (tab: "env" | "tools" | "agents") => void;
  actions: ReactNode;
  status: ReactNode;
  hasUpdate: boolean;
}

export function ClassicHeader({
  activeApp,
  brandActive,
  brandReady,
  visibleApps,
  onSelectApp,
  onSelectPage,
  onSelectAppPage,
  onOpenClawConfig,
  actions,
  status,
  hasUpdate,
}: ClassicHeaderProps) {
  const { t } = useTranslation();
  const windowControls = useContext(WindowControlsContext);
  const sharedApp = sharedFeatureAppOf(activeApp);
  const tool = (label: string, icon: ReactNode, onClick: () => void) => (
    <HoverTip content={label}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label={label}
        onClick={onClick}
      >
        {icon}
      </Button>
    </HoverTip>
  );
  return (
    <header
      className="flex h-16 shrink-0 items-center gap-3 bg-background/80 px-6 backdrop-blur-md"
      {...DRAG_REGION_ATTR}
      style={DRAG_REGION_STYLE}
    >
      <a href="#main-content" className="sr-only focus:not-sr-only">
        {t("nav.skipToContent")}
      </a>
      <div className="flex shrink-0 items-center gap-1">
        <span style={NO_DRAG}>
          <RoutingActivationBrand
            active={brandActive}
            contextKey={activeApp}
            ready={brandReady}
          />
        </span>
        <div className="relative">
          {tool(t("common.settings"), <Settings className="h-4 w-4" />, () =>
            onSelectPage("settings"),
          )}
          {hasUpdate && (
            <span className="pointer-events-none absolute right-1 top-1 h-2 w-2 rounded-full bg-green-500" />
          )}
        </div>
      </div>
      <div className="flex min-w-0 max-w-36 items-center">{status}</div>
      <div className="flex min-w-[100px] flex-1 items-center justify-end overflow-hidden">
        <AppSwitcher
          activeApp={activeApp}
          visibleApps={visibleApps}
          onSwitch={onSelectApp}
        />
      </div>
      <nav
        aria-label={t("nav.mainLabel")}
        className="flex shrink-0 items-center gap-1 rounded-xl bg-muted p-1"
      >
        {activeApp === "openclaw" ? (
          <>
            {tool(
              t("workspace.manage"),
              <FolderOpen className="h-4 w-4" />,
              () => onSelectAppPage("workspace"),
            )}
            {tool(
              t("openclaw.env.title"),
              <KeyRound className="h-4 w-4" />,
              () => onOpenClawConfig("env"),
            )}
            {tool(
              t("openclaw.tools.title"),
              <Shield className="h-4 w-4" />,
              () => onOpenClawConfig("tools"),
            )}
            {tool(t("openclaw.agents.title"), <Cpu className="h-4 w-4" />, () =>
              onOpenClawConfig("agents"),
            )}
          </>
        ) : (
          <>
            {SKILLS_APP_IDS.includes(sharedApp) &&
              tool(t("skills.manage"), <Wrench className="h-4 w-4" />, () =>
                onSelectPage("skills"),
              )}
            {activeApp === "hermes"
              ? tool(
                  t("hermes.memory.title"),
                  <Brain className="h-4 w-4" />,
                  () => onSelectAppPage("hermesMemory"),
                )
              : PROMPT_APP_IDS.includes(sharedApp) &&
                tool(t("nav.prompts"), <Book className="h-4 w-4" />, () =>
                  onSelectPage("prompts"),
                )}
            {isMcpAppId(sharedApp) &&
              tool(t("mcp.title"), <McpIcon size={16} />, () =>
                onSelectPage("mcp"),
              )}
          </>
        )}
        {tool(t("nav.sessions"), <History className="h-4 w-4" />, () =>
          onSelectPage("sessions"),
        )}
      </nav>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
      {windowControls && (
        <div className="flex shrink-0 items-center">{windowControls}</div>
      )}
    </header>
  );
}
