import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ProviderGroupDefinition, ProviderGroupsMap } from "@/types";
import { settingsApi } from "@/lib/api/settings";
import { useSettingsQuery } from "@/lib/query/queries";
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
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, string[]>)
      : {};
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
  // ref 保证连续两次拖拽提交（前一次仍在保存）时，后一次的底稿包含前一次的改动
  const [localGroupsMap, setLocalGroupsMap] = useState<ProviderGroupsMap>(
    () => settings?.providerGroups ?? {},
  );
  const localMapRef = useRef<ProviderGroupsMap>(settings?.providerGroups ?? {});
  useEffect(() => {
    const incoming = settings?.providerGroups;
    // 查询未到货（undefined）时保持本地态：既避免用新对象反复重置，
    // 也让保存后的乐观态（删除了空桶）在下次刷新前不被 undefined/null 冲掉
    if (incoming == null || incoming === localMapRef.current) return;
    localMapRef.current = incoming;
    setLocalGroupsMap(incoming);
  }, [settings?.providerGroups]);

  const saveMutation = useMutation({
    mutationFn: (next: ProviderGroupsMap) =>
      settingsApi.saveProviderGroups(next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => {
      console.error("Failed to save provider groups", error);
      toast.error(
        t("providerGroups.saveFailed", {
          defaultValue: "分组保存失败",
        }),
      );
    },
  });

  const appGroups = useMemo(
    () => localGroupsMap[appId] ?? [],
    [localGroupsMap, appId],
  );

  const saveAppGroups = useCallback(
    (next: ProviderGroupDefinition[]) => {
      const map = { ...localMapRef.current };
      if (next.length === 0) {
        delete map[appId];
      } else {
        map[appId] = next;
      }
      localMapRef.current = map;
      setLocalGroupsMap(map);
      saveMutation.mutate(map);
    },
    [appId, saveMutation],
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
    saveAppGroups,
    isSaving: saveMutation.isPending,
    isGroupCollapsed,
    setGroupCollapsed,
  };
}

/** 分组视图组件经 props 接收（hook 在 ProviderList 提升为单实例，避免乐观态分叉） */
export type ProviderGroupsApi = ReturnType<typeof useProviderGroups>;
