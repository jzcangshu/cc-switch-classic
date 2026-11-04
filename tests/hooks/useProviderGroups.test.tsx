import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderGroups } from "@/hooks/useProviderGroups";
import { settingsApi } from "@/lib/api/settings";
import type { Settings } from "@/types";
vi.mock("@/lib/api/settings", () => ({
  settingsApi: { get: vi.fn(), saveProviderGroups: vi.fn() },
}));
const initial: Settings = {
  showInTray: true,
  minimizeToTrayOnClose: true,
  providerGroupingMode: "menu",
  providerGroups: {
    claude: [{ id: "g", name: "Work", providerIds: ["a"] }],
    codex: [{ id: "other", name: "Other", providerIds: ["b"] }],
  },
};
function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  client.setQueryData(["settings"], initial);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...renderHook(() => useProviderGroups("claude"), { wrapper }),
  };
}
beforeEach(() => {
  localStorage.removeItem("cc-switch.providerGroups.collapsed");
  vi.mocked(settingsApi.get).mockResolvedValue(initial);
  vi.mocked(settingsApi.saveProviderGroups).mockImplementation(
    async (app, groups) => {
      vi.mocked(settingsApi.get).mockResolvedValue({
        ...initial,
        providerGroups: { ...initial.providerGroups, [app]: groups },
      });
      return true;
    },
  );
});
describe("provider grouping persistence", () => {
  it("saves only the active application and preserves unrelated settings", async () => {
    const { result, client } = setup();
    const next = [{ id: "g", name: "Renamed", providerIds: ["a"] }];
    await act(() => result.current.saveAppGroups(next));
    expect(settingsApi.saveProviderGroups).toHaveBeenCalledWith("claude", next);
    expect(
      client.getQueryData<Settings>(["settings"])?.providerGroups?.codex,
    ).toEqual(initial.providerGroups!.codex);
    expect(result.current.mode).toBe("menu");
    expect(result.current.groups).toEqual(next);
  });
  it("rolls back failed persistence and permits a retry", async () => {
    const { result } = setup();
    vi.mocked(settingsApi.saveProviderGroups).mockRejectedValueOnce(
      new Error("disk full"),
    );
    await act(async () => {
      await expect(result.current.saveAppGroups([])).rejects.toThrow(
        "disk full",
      );
    });
    expect(result.current.groups).toEqual(initial.providerGroups!.claude);
    await act(() => result.current.saveAppGroups([]));
    await waitFor(() => expect(result.current.groups).toEqual([]));
  });
  it("retains collapsed state across remounts and ignores malformed local state", () => {
    localStorage.setItem(
      "cc-switch.providerGroups.collapsed",
      JSON.stringify({ claude: 42 }),
    );
    const first = setup();
    expect(first.result.current.isGroupCollapsed("g")).toBe(false);
    act(() => first.result.current.setGroupCollapsed("g", true));
    first.unmount();
    expect(setup().result.current.isGroupCollapsed("g")).toBe(true);
  });
});
