import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";
import { AppVisibilitySettings } from "@/components/settings/AppVisibilitySettings";
import { APP_IDS, DEFAULT_VISIBLE_APPS } from "@/config/appConfig";
import type { SettingsFormState } from "@/hooks/useSettings";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const settingsWith = (visibleApps = DEFAULT_VISIBLE_APPS) =>
  ({ visibleApps: { ...visibleApps } }) as unknown as SettingsFormState;

describe("AppVisibilitySettings", () => {
  it("offers a toggle for every app, including newly added ones", () => {
    render(
      <AppVisibilitySettings
        settings={settingsWith()}
        onChange={() => undefined}
      />,
    );

    // 一个 AppId 一个开关：新应用加到 APP_IDS 后漏在这里会被数量断言抓住
    expect(screen.getAllByRole("button")).toHaveLength(APP_IDS.length);
    expect(screen.getByText("apps.kimi")).toBeInTheDocument();
    expect(screen.getByText("apps.omp")).toBeInTheDocument();
  });

  it("turns Kimi Code off from the home visibility settings", () => {
    const onChange = vi.fn();
    render(
      <AppVisibilitySettings settings={settingsWith()} onChange={onChange} />,
    );

    fireEvent.click(screen.getByText("apps.kimi").closest("button")!);

    expect(onChange).toHaveBeenCalledWith({
      visibleApps: { ...DEFAULT_VISIBLE_APPS, kimi: false },
    });
  });
});
