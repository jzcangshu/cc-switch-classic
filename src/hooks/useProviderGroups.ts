import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type {
  ProviderGroupDefinition,
  ProviderGroupsMap,
  Settings,
} from "@/types";
import { settingsApi } from "@/lib/api/settings";
import { useSettingsQuery } from "@/lib/query/queries";
import { resolveProviderGroupingMode } from "@/lib/providerGroups";
import { toast } from "@/lib/toast";

/**
 * 主页供应商卡片分组的视图状态层：
 * 分组定义存 settings.json（经 save_provider_groups 单字段读改写），
 * 折叠态是纯视图态，存 localStorage（SessionManager 同款模式）。
 * 保存走本地乐观更新，避免拖拽提交后等查询刷新时的闪变。
 */

const COLLAPSED_STORAGE_KEY = "cc-switch.providerGroups.collapsed";

function loadCollapsedMap(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string[]] =>
          Array.isArray(entry[1]) &&
          entry[1].every((id) => typeof id === "string"),
      ),
    );
  } catch {
    return {};
  }
}

function persistCollapsedMap(map: Record<string, string[]>) {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // 存储不可用时折叠态退化为内存态，不影响功能
  }
}

export function useProviderGroups(appId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: settings } = useSettingsQuery();

  // 本地乐观副本：settings 到货 / 变化时跟随，提交时先改本地再落盘。
  // 正在保存时忽略旧查询回读；跨应用保存仅修改对应桶。
  const [localGroupsMap, setLocalGroupsMap] = useState<ProviderGroupsMap>(
    () => settings?.providerGroups ?? {},
  );
  const localMapRef = useRef<ProviderGroupsMap>(settings?.providerGroups ?? {});
  const savingRef = useRef(false);
  useEffect(() => {
    const incoming = settings?.providerGroups;
    if (!settings || savingRef.current || incoming === localMapRef.current)
      return;
    localMapRef.current = incoming ?? {};
    setLocalGroupsMap(incoming ?? {});
  }, [settings]);

  const saveMutation = useMutation({
    scope: { id: "provider-groups" },
    mutationFn: ({
      app,
      groups,
    }: {
      app: string;
      groups: ProviderGroupDefinition[];
    }) => settingsApi.saveProviderGroups(app, groups),
  });

  const appGroups = useMemo(
    () => localGroupsMap[appId] ?? [],
    [localGroupsMap, appId],
  );

  const saveAppGroups = useCallback(
    async (next: ProviderGroupDefinition[]) => {
      if (savingRef.current)
        throw new Error("A group save is already in progress");
      const previous = localMapRef.current;
      const map = { ...previous };
      if (next.length === 0) delete map[appId];
      else map[appId] = next;
      savingRef.current = true;
      localMapRef.current = map;
      setLocalGroupsMap(map);
      try {
        const saved = await saveMutation.mutateAsync({
          app: appId,
          groups: next,
        });
        if (!saved) throw new Error("Provider groups were not saved");
        queryClient.setQueryData<Settings>(["settings"], (old) =>
          old
            ? {
                ...old,
                providerGroups: { ...old.providerGroups, [appId]: next },
              }
            : old,
        );
      } catch (error) {
        localMapRef.current = previous;
        setLocalGroupsMap(previous);
        toast.error(t("providerGroups.saveFailed"));
        throw error;
      } finally {
        savingRef.current = false;
        void queryClient.invalidateQueries({ queryKey: ["settings"] });
      }
    },
    [appId, saveMutation.mutateAsync, queryClient, t],
  );

  const [collapsedMap, setCollapsedMap] =
    useState<Record<string, string[]>>(loadCollapsedMap);

  const isGroupCollapsed = useCallback(
    (groupId: string) => collapsedMap[appId]?.includes(groupId) ?? false,
    [collapsedMap, appId],
  );

  const setGroupCollapsed = useCallback(
    (groupId: string, collapsed: boolean) => {
      setCollapsedMap((prev) => {
        const current = prev[appId] ?? [];
        const next = collapsed
          ? current.includes(groupId)
            ? current
            : [...current, groupId]
          : current.filter((id) => id !== groupId);
        persistCollapsedMap({ ...prev, [appId]: next });
        return { ...prev, [appId]: next };
      });
    },
    [appId],
  );

  return {
    groups: appGroups,
    mode: resolveProviderGroupingMode(settings),
    saveAppGroups,
    isSaving: saveMutation.isPending,
    isGroupCollapsed,
    setGroupCollapsed,
  };
}

/** 分组视图组件经 props 接收（hook 在 ProviderList 提升为单实例，避免乐观态分叉） */
export type ProviderGroupsApi = ReturnType<typeof useProviderGroups>;
