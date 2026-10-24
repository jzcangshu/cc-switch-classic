import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppSwitcher } from "@/components/AppSwitcher";
import { ClassicStatusBar } from "@/components/shell/ClassicStatusBar";
import { DEFAULT_VISIBLE_APPS } from "@/config/appConfig";

const status = vi.hoisted(() => ({
  appStatus: (app: string) => ({
    mode: "route" as const,
    alert: app === "codex",
  }),
  todayCost: 5,
  todayTokens: 5000,
  todayRequests: 12,
  todayHitRate: 0.5,
  authNeedsAttention: true,
}));
vi.mock("@/hooks/useSidebarStatus", () => ({ useSidebarStatus: () => status }));
vi.mock("@/hooks/useMoneyFormat", () => ({
  useMoneyFormat: () => ({ moneyShort: (value: number) => `$${value}` }),
}));
vi.mock("@/lib/query", () => ({
  useSettingsQuery: () => ({
    data: { usageDisplay: { sidebarTodayItems: ["cost", "requests"] } },
  }),
}));

describe("classic navigation", () => {
  beforeEach(() => localStorage.clear());

  it("lets the parent accept an app switch before changing the persisted app", () => {
    localStorage.setItem("cc-switch-last-app", "claude");
    const onSwitch = vi.fn();
    render(
      <AppSwitcher
        activeApp="claude"
        visibleApps={DEFAULT_VISIBLE_APPS}
        onSwitch={onSwitch}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Antigravity" }));
    expect(onSwitch).toHaveBeenCalledWith("agy");
    expect(localStorage.getItem("cc-switch-last-app")).toBe("claude");
    expect(screen.getByRole("button", { name: "Claude Code" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps V4 reauthentication, stopped routing and chosen today metrics actionable", () => {
    const onOpenApp = vi.fn();
    const onOpenPage = vi.fn();
    render(
      <ClassicStatusBar
        visibleApps={DEFAULT_VISIBLE_APPS}
        onOpenApp={onOpenApp}
        onOpenPage={onOpenPage}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Codex/ }));
    expect(onOpenApp).toHaveBeenCalledWith("codex");
    fireEvent.click(
      screen.getByRole("button", { name: "nav.authNeedsReauth" }),
    );
    expect(onOpenPage).toHaveBeenCalledWith("auth");
    fireEvent.click(screen.getByRole("button", { name: "nav.today" }));
    expect(onOpenPage).toHaveBeenCalledWith("usage");
  });
});
