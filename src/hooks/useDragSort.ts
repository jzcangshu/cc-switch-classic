import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { useTranslation } from "react-i18next";
import type { Provider } from "@/types";
import { providersApi, type AppId } from "@/lib/api";
import { isProxyAppId } from "@/config/appConfig";
import type { ProvidersQueryData } from "@/lib/query/queries";

export function useDragSort(providers: Record<string, Provider>, appId: AppId) {
  const queryClient = useQueryClient();
  const saving = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{
    appId: AppId;
    ids: string[];
  } | null>(null);
  const { t, i18n } = useTranslation();

  const persistedProviders = useMemo(() => {
    const locale =
      i18n.language === "zh"
        ? "zh-CN"
        : i18n.language === "zh-TW"
          ? "zh-TW"
          : "en-US";
    return Object.values(providers).sort((a, b) => {
      if (a.sortIndex !== undefined && b.sortIndex !== undefined) {
        return a.sortIndex - b.sortIndex;
      }
      if (a.sortIndex !== undefined) return -1;
      if (b.sortIndex !== undefined) return 1;

      const timeA = a.createdAt ?? 0;
      const timeB = b.createdAt ?? 0;
      if (timeA && timeB && timeA !== timeB) {
        return timeA - timeB;
      }

      return a.name.localeCompare(b.name, locale);
    });
  }, [providers, i18n.language]);

  const sortedProviders = useMemo(() => {
    if (pendingOrder?.appId !== appId) return persistedProviders;
    const seen = new Set(pendingOrder.ids);
    return [
      ...pendingOrder.ids.flatMap((id) =>
        providers[id] ? [providers[id]] : [],
      ),
      ...persistedProviders.filter((p) => !seen.has(p.id)),
    ];
  }, [pendingOrder, appId, persistedProviders, providers]);
  // 保存完成不等于列表已收到新 props；只在实际顺序追上后交回持久化数据。
  useEffect(() => {
    if (
      pendingOrder?.appId === appId &&
      pendingOrder.ids.length === persistedProviders.length &&
      pendingOrder.ids.every((id, index) => id === persistedProviders[index].id)
    )
      setPendingOrder(null);
  }, [pendingOrder, appId, persistedProviders]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (saving.current || !over || active.id === over.id) {
        return;
      }

      const oldIndex = sortedProviders.findIndex(
        (provider) => provider.id === active.id,
      );
      const newIndex = sortedProviders.findIndex(
        (provider) => provider.id === over.id,
      );

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const reordered = arrayMove(sortedProviders, oldIndex, newIndex);
      const updates = reordered.map((provider, index) => ({
        id: provider.id,
        sortIndex: index,
      }));

      saving.current = true;
      setIsSaving(true);
      // 与拖动结束同一批渲染落位，不等待查询缓存的异步通知。
      setPendingOrder({ appId, ids: reordered.map((p) => p.id) });
      const queryKey = ["providers", appId];
      // 先同步取消旧回读并发布最终顺序，避免松手先回到旧位置、保存后再跳一次。
      void queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ProvidersQueryData>(queryKey);
      const indexes = new Map(
        updates.map(({ id, sortIndex }) => [id, sortIndex]),
      );
      queryClient.setQueryData<ProvidersQueryData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          providers: Object.fromEntries(
            Object.entries(old.providers).map(([id, provider]) => [
              id,
              indexes.has(id)
                ? { ...provider, sortIndex: indexes.get(id) }
                : provider,
            ]),
          ),
        };
      });

      try {
        const saved = await providersApi.updateSortOrder(updates, appId);
        if (!saved) throw new Error("Provider order was not saved");
        await queryClient.invalidateQueries({
          queryKey: ["providers", appId],
        });

        // Routing apps derive failover order from sort_index.
        if (isProxyAppId(appId)) {
          await queryClient.invalidateQueries({
            queryKey: ["failoverQueue", appId],
          });
        }

        // 更新托盘菜单以反映新的排序（失败不影响主操作）
        try {
          await providersApi.updateTrayMenu();
        } catch (trayError) {
          console.error("Failed to update tray menu after sort", trayError);
          // 托盘菜单更新失败不影响排序成功
        }

        toast.success(
          t("provider.sortUpdated", {
            defaultValue: "排序已更新",
          }),
          { closeButton: true },
        );
      } catch (error) {
        setPendingOrder(null);
        // 只回退本次修改的排序字段，保留保存期间的其他供应商更新。
        queryClient.setQueryData<ProvidersQueryData>(queryKey, (old) => {
          if (!old || !previous) return old;
          return {
            ...old,
            providers: Object.fromEntries(
              Object.entries(old.providers).map(([id, provider]) => [
                id,
                previous.providers[id] && provider.sortIndex === indexes.get(id)
                  ? { ...provider, sortIndex: previous.providers[id].sortIndex }
                  : provider,
              ]),
            ),
          };
        });
        await queryClient.invalidateQueries({ queryKey });
        console.error("Failed to update provider sort order", error);
        toast.error(
          t("provider.sortUpdateFailed", {
            defaultValue: "排序更新失败",
          }),
        );
      } finally {
        setIsSaving(false);
        saving.current = false;
      }
    },
    [sortedProviders, appId, queryClient, t],
  );

  return {
    sortedProviders,
    sensors,
    handleDragEnd,
    isSaving,
  };
}
