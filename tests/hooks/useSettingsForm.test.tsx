import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import i18n from "i18next";
import { useSettingsForm } from "@/hooks/useSettingsForm";
import type { Settings } from "@/types";

const useSettingsQueryMock = vi.fn();

vi.mock("@/lib/query", () => ({
  useSettingsQuery: (...args: unknown[]) => useSettingsQueryMock(...args),
}));

let changeLanguageSpy: ReturnType<typeof vi.spyOn<any, any>>;

beforeEach(() => {
  useSettingsQueryMock.mockReset();
  window.localStorage.clear();
  (i18n as any).language = "zh";
  changeLanguageSpy = vi
    .spyOn(i18n, "changeLanguage")
    .mockImplementation(async (lang?: string) => {
      (i18n as any).language = lang;
      return i18n.t;
    });
});

afterEach(() => {
  changeLanguageSpy.mockRestore();
});

describe("useSettingsForm Hook", () => {
  it("should normalize settings and sync language on initialization", async () => {
    useSettingsQueryMock.mockReturnValue({
      data: {
        showInTray: undefined,
        minimizeToTrayOnClose: undefined,
        enableClaudePluginIntegration: undefined,
        claudeConfigDir: "  /Users/demo  ",
        codexConfigDir: "   ",
        language: "en",
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useSettingsForm());

    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    const settings = result.current.settings!;
    expect(settings.showInTray).toBe(true);
    expect(settings.minimizeToTrayOnClose).toBe(true);
    expect(settings.enableClaudePluginIntegration).toBe(false);
    expect(settings.claudeConfigDir).toBe("/Users/demo");
    expect(settings.codexConfigDir).toBeUndefined();
    expect(settings.language).toBe("en");
    expect(result.current.initialLanguage).toBe("en");
    expect(changeLanguageSpy).toHaveBeenCalledWith("en");
  });

  it("preserves Turkish from server settings", async () => {
    useSettingsQueryMock.mockReturnValue({
      data: { language: "tr" },
      isLoading: false,
    });
    const { result } = renderHook(() => useSettingsForm());
    await waitFor(() => expect(result.current.settings?.language).toBe("tr"));
    expect(result.current.initialLanguage).toBe("tr");
    expect(changeLanguageSpy).toHaveBeenCalledWith("tr");
  });

  it("should support japanese language preference from server data", async () => {
    useSettingsQueryMock.mockReturnValue({
      data: {
        showInTray: true,
        minimizeToTrayOnClose: true,
        enableClaudePluginIntegration: false,
        claudeConfigDir: "/Users/demo",
        codexConfigDir: null,
        language: "ja",
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useSettingsForm());

    await waitFor(() => {
      expect(result.current.settings?.language).toBe("ja");
    });

    expect(result.current.initialLanguage).toBe("ja");
    expect(changeLanguageSpy).toHaveBeenCalledWith("ja");
  });

  it("should support traditional chinese language preference aliases", async () => {
    useSettingsQueryMock.mockReturnValue({
      data: {
        showInTray: true,
        minimizeToTrayOnClose: true,
        enableClaudePluginIntegration: false,
        claudeConfigDir: "/Users/demo",
        codexConfigDir: null,
        language: "zh-Hant",
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useSettingsForm());

    await waitFor(() => {
      expect(result.current.settings?.language).toBe("zh-TW");
    });

    expect(result.current.initialLanguage).toBe("zh-TW");
    expect(changeLanguageSpy).toHaveBeenCalledWith("zh-TW");
  });

  it("should prioritize reading language from local storage in readPersistedLanguage", () => {
    useSettingsQueryMock.mockReturnValue({
      data: null,
      isLoading: false,
    });
    window.localStorage.setItem("language", "en");

    const { result } = renderHook(() => useSettingsForm());

    const lang = result.current.readPersistedLanguage();
    expect(lang).toBe("en");
    expect(changeLanguageSpy).not.toHaveBeenCalled();
  });

  it("should update fields and sync language when language changes in updateSettings", () => {
    useSettingsQueryMock.mockReturnValue({
      data: null,
      isLoading: false,
    });

    const { result } = renderHook(() => useSettingsForm());

    act(() => {
      result.current.updateSettings({ showInTray: false });
    });

    expect(result.current.settings?.showInTray).toBe(false);

    changeLanguageSpy.mockClear();
    act(() => {
      result.current.updateSettings({ language: "en" });
    });

    expect(result.current.settings?.language).toBe("en");
    expect(changeLanguageSpy).toHaveBeenCalledWith("en");
  });

  it("should reset with server data and restore initial language in resetSettings", async () => {
    useSettingsQueryMock.mockReturnValue({
      data: {
        showInTray: true,
        minimizeToTrayOnClose: true,
        enableClaudePluginIntegration: false,
        claudeConfigDir: "/origin",
        codexConfigDir: null,
        language: "en",
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useSettingsForm());

    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    changeLanguageSpy.mockClear();
    (i18n as any).language = "zh";

    act(() => {
      result.current.resetSettings({
        showInTray: false,
        minimizeToTrayOnClose: false,
        enableClaudePluginIntegration: true,
        claudeConfigDir: "  /reset  ",
        codexConfigDir: "   ",
        piConfigDir: "  /pi-reset  ",
        language: "zh",
      });
    });

    const settings = result.current.settings!;
    expect(settings.showInTray).toBe(false);
    expect(settings.minimizeToTrayOnClose).toBe(false);
    expect(settings.enableClaudePluginIntegration).toBe(true);
    expect(settings.claudeConfigDir).toBe("/reset");
    expect(settings.codexConfigDir).toBeUndefined();
    expect(settings.piConfigDir).toBe("/pi-reset");
    expect(settings.language).toBe("zh");
    expect(result.current.initialLanguage).toBe("en");
    expect(changeLanguageSpy).toHaveBeenCalledWith("en");
  });

  it("should not call changeLanguage repeatedly when language is consistent in syncLanguage", async () => {
    useSettingsQueryMock.mockReturnValue({
      data: {
        showInTray: true,
        minimizeToTrayOnClose: true,
        enableClaudePluginIntegration: false,
        claudeConfigDir: null,
        codexConfigDir: null,
        language: "zh",
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useSettingsForm());

    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    changeLanguageSpy.mockClear();
    (i18n as any).language = "zh";

    act(() => {
      result.current.syncLanguage("zh");
    });

    expect(changeLanguageSpy).not.toHaveBeenCalled();
  });
});

describe("directory drafts across classic settings tabs", () => {
  it("retains edited paths across unrelated settings refreshes, then follows remote paths after saving", async () => {
    const first = {
      language: "zh",
      claudeConfigDir: "/saved",
      codexConfigDir: "/codex",
      showInTray: true,
    };
    useSettingsQueryMock.mockReturnValue({ data: first, isLoading: false });
    const { result, rerender } = renderHook(() => useSettingsForm());
    await waitFor(() =>
      expect(result.current.settings?.claudeConfigDir).toBe("/saved"),
    );
    act(() => result.current.updateSettings({ claudeConfigDir: "/draft" }));
    useSettingsQueryMock.mockReturnValue({
      data: { ...first, showInTray: false, codexConfigDir: "/external-codex" },
      isLoading: false,
    });
    rerender();
    await waitFor(() =>
      expect(result.current.settings?.showInTray).toBe(false),
    );
    expect(result.current.settings?.claudeConfigDir).toBe("/draft");
    expect(result.current.settings?.codexConfigDir).toBe("/external-codex");
    useSettingsQueryMock.mockReturnValue({
      data: { ...first, claudeConfigDir: "/draft" },
      isLoading: false,
    });
    rerender();
    await waitFor(() => expect(result.current.settings?.showInTray).toBe(true));
    useSettingsQueryMock.mockReturnValue({
      data: { ...first, claudeConfigDir: "/later-external" },
      isLoading: false,
    });
    rerender();
    await waitFor(() =>
      expect(result.current.settings?.claudeConfigDir).toBe("/later-external"),
    );
  });

  it("keeps a reset-to-default path as an unsaved draft and explicit reset discards it", async () => {
    const saved: Settings = {
      language: "zh",
      claudeConfigDir: "/saved",
      showInTray: true,
      minimizeToTrayOnClose: true,
    };
    useSettingsQueryMock.mockReturnValue({ data: saved, isLoading: false });
    const { result, rerender } = renderHook(() => useSettingsForm());
    await waitFor(() =>
      expect(result.current.settings?.claudeConfigDir).toBe("/saved"),
    );
    act(() => result.current.updateSettings({ claudeConfigDir: undefined }));
    useSettingsQueryMock.mockReturnValue({
      data: { ...saved, showInTray: false },
      isLoading: false,
    });
    rerender();
    await waitFor(() =>
      expect(result.current.settings?.showInTray).toBe(false),
    );
    expect(result.current.settings?.claudeConfigDir).toBeUndefined();
    act(() => result.current.resetSettings(saved));
    expect(result.current.settings?.claudeConfigDir).toBe("/saved");
    useSettingsQueryMock.mockReturnValue({
      data: { ...saved, claudeConfigDir: "/remote" },
      isLoading: false,
    });
    rerender();
    await waitFor(() =>
      expect(result.current.settings?.claudeConfigDir).toBe("/remote"),
    );
  });
});
