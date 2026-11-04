import { act, renderHook } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGroupLayoutCommit } from "@/components/providers/grouping/useGroupLayoutCommit";
import { providersApi } from "@/lib/api/providers";
import { toast } from "@/lib/toast";
import { UNGROUPED_ID } from "@/lib/providerGroups";
import type { ProviderGroupsApi } from "@/hooks/useProviderGroups";
import type { ProvidersQueryData } from "@/lib/query/queries";
vi.mock("@/lib/api/providers", () => ({
  providersApi: { updateSortOrder: vi.fn(), updateTrayMenu: vi.fn() },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
const providers = ["a", "b"].map((id, sortIndex) => ({
  id,
  name: id,
  sortIndex,
  settingsConfig: {},
}));
const initial: ProvidersQueryData = {
  providers: Object.fromEntries(providers.map((p) => [p.id, p])),
  currentProviderId: "a",
};
const groups = [{ id: "g", name: "Work", providerIds: ["b"] }];
const pending = { g: ["b"], [UNGROUPED_ID]: ["a"] };
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["providers", "claude"], initial);
  const saveAppGroups = vi.fn().mockResolvedValue(undefined);
  const api: ProviderGroupsApi = {
    groups: [],
    mode: "menu",
    saveAppGroups,
    isSaving: false,
    isGroupCollapsed: () => false,
    setGroupCollapsed: vi.fn(),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () => {
      useQuery({
        queryKey: ["providers", "claude"],
        queryFn: async () => initial,
      });
      return useGroupLayoutCommit("claude", providers, providers, api);
    },
    { wrapper },
  );
  return { ...hook, client, saveAppGroups };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(providersApi.updateSortOrder).mockResolvedValue(true);
  vi.mocked(providersApi.updateTrayMenu).mockResolvedValue(true);
});
describe("shared group commit", () => {
  it("refreshes authoritative order and releases the lock after a rejected group save", async () => {
    const { result, client, saveAppGroups } = setup();
    saveAppGroups.mockRejectedValueOnce(new Error("disk full"));
    await act(() => result.current.commitLayout(pending, groups));
    expect(providersApi.updateSortOrder).not.toHaveBeenCalled();
    expect(client.getQueryData(["providers", "claude"])).toEqual(initial);
    expect(result.current.isSaving).toBe(false);
    await act(() => result.current.commitLayout(pending, groups));
    expect(providersApi.updateSortOrder).toHaveBeenCalledOnce();
  });
  it.each(["reject", "false"])(
    "reports partial success when sorting returns %s",
    async (failure) => {
      const { result, client, saveAppGroups } = setup();
      if (failure === "reject")
        vi.mocked(providersApi.updateSortOrder).mockRejectedValueOnce(
          new Error("sort failed"),
        );
      else vi.mocked(providersApi.updateSortOrder).mockResolvedValueOnce(false);
      await act(() => result.current.commitLayout(pending, groups));
      expect(saveAppGroups).toHaveBeenCalledWith(groups);
      expect(toast.error).toHaveBeenCalledOnce();
      expect(providersApi.updateTrayMenu).not.toHaveBeenCalled();
      expect(client.getQueryData(["providers", "claude"])).toEqual(initial);
      expect(result.current.isSaving).toBe(false);
    },
  );
  it("does not submit a second layout while the first is saving", async () => {
    const { result, saveAppGroups } = setup();
    let finish!: () => void;
    saveAppGroups.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    let first!: Promise<void>;
    act(() => {
      first = result.current.commitLayout(pending, groups);
    });
    await act(() => result.current.commitLayout(pending, groups));
    expect(saveAppGroups).toHaveBeenCalledOnce();
    await act(async () => {
      finish();
      await first;
    });
    expect(result.current.isSaving).toBe(false);
  });
});
