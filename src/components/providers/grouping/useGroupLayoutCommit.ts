import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Provider, ProviderGroupDefinition } from "@/types";
import type { AppId } from "@/lib/api";
import type { ProvidersQueryData } from "@/lib/query/queries";
import type { ProviderGroupsApi } from "@/hooks/useProviderGroups";
import { providersApi } from "@/lib/api/providers";
import { isProxyAppId } from "@/config/appConfig";
import { toast } from "@/lib/toast";
import {
  buildSortIndexUpdates,
  pendingLayoutToContainers,
  pendingToGroups,
  type PendingLayout,
} from "@/lib/providerGroups";

/** 两种交互使用同一提交路径；保存失败刷新真实状态，区分分组与排序部分失败。 */
export function useGroupLayoutCommit(
  appId: AppId,
  primaryProviders: Provider[],
  sortedProviders: Provider[],
  providerGroups: ProviderGroupsApi,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const busy = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const commitLayout = useCallback(
    async (pending: PendingLayout, draftGroups: ProviderGroupDefinition[]) => {
      if (busy.current || providerGroups.isSaving) return;
      busy.current = true;
      setIsSaving(true);
      let groupsSaved = false;
      try {
        const validIds = new Set(primaryProviders.map((p) => p.id));
        const nextGroups = pendingToGroups(
          draftGroups,
          pending,
          validIds,
          new Set(sortedProviders.map((p) => p.id)),
        );
        const layout = pendingLayoutToContainers(
          nextGroups,
          pending,
          primaryProviders,
        );
        const updates = buildSortIndexUpdates(
          layout,
          validIds,
          sortedProviders,
        );
        queryClient.setQueryData<ProvidersQueryData>(
          ["providers", appId],
          (old) => {
            if (!old) return old;
            const indexes = new Map(updates.map((u) => [u.id, u.sortIndex]));
            return {
              ...old,
              providers: Object.fromEntries(
                Object.entries(old.providers).map(([id, p]) => [
                  id,
                  indexes.has(id) ? { ...p, sortIndex: indexes.get(id) } : p,
                ]),
              ),
            };
          },
        );
        await providerGroups.saveAppGroups(nextGroups);
        groupsSaved = true;
        const sorted = await providersApi.updateSortOrder(updates, appId);
        if (!sorted) throw new Error("Provider order was not saved");
        try {
          await providersApi.updateTrayMenu();
        } catch (error) {
          console.error("Failed to refresh tray after grouping", error);
        }
      } catch (error) {
        console.error("Failed to commit provider grouping", error);
        if (groupsSaved) toast.error(t("providerGroups.sortSaveFailed"));
      } finally {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["providers", appId] }),
          ...(isProxyAppId(appId)
            ? [
                queryClient.invalidateQueries({
                  queryKey: ["failoverQueue", appId],
                }),
              ]
            : []),
        ]);
        busy.current = false;
        setIsSaving(false);
      }
    },
    [
      appId,
      primaryProviders,
      sortedProviders,
      providerGroups.saveAppGroups,
      providerGroups.isSaving,
      queryClient,
      t,
    ],
  );
  return { commitLayout, isSaving: isSaving || providerGroups.isSaving };
}
