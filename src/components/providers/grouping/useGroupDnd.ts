import { useCallback, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  KeyboardSensor,
  pointerWithin,
  PointerSensor,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useTranslation } from "react-i18next";
import type { Provider, ProviderGroupDefinition } from "@/types";
import {
  createGroupWithProviders,
  DWELL_CREATE_GROUP_MS,
  DWELL_EXPAND_GROUP_MS,
  layoutToPending,
  moveProviderInPending,
  reorderGroups,
  resolveGroupedLayout,
  UNGROUPED_ID,
  type GroupContainerLayout,
  type PendingLayout,
} from "@/lib/providerGroups";

interface UseGroupDndInput {
  primaryProviders: Provider[];
  groups: ProviderGroupDefinition[];
  isGroupCollapsed: (groupId: string) => boolean;
  expandGroup: (groupId: string) => void;
  /** 唯一提交漏斗：菜单移动 / 卡片拖拽 / 分组重排都落到「内存态布局 + 分组定义」 */
  commitLayout: (
    pending: PendingLayout,
    draftGroups: ProviderGroupDefinition[],
  ) => void;
  /** 非主分区（可添加等）卡片的拖拽沿用平铺逻辑 */
  onFlatDragEnd: (event: DragEndEvent) => void;
}

/**
 * 多容器拖拽编排（iOS 文件夹手势）：
 * - 拖拽中的归属变化只进内存态（pending + draftGroups），松手经 commitLayout 落盘；
 * - 悬停另一张未分组卡片 DWELL_CREATE_GROUP_MS 后合成新分组；
 * - 悬停折叠分组 DWELL_EXPAND_GROUP_MS 后自动展开；
 * - 分组头拖动 = 分组重排（同样走提交漏斗，sortIndex 随组序重写）。
 */
export function useGroupDnd(input: UseGroupDndInput) {
  const { t } = useTranslation();
  const { primaryProviders, groups } = input;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [dragState, setDragState] = useState<{
    activeId: string;
    activeType: "card" | "group";
  } | null>(null);
  const [draftGroups, setDraftGroups] = useState<ProviderGroupDefinition[]>([]);
  const [pending, setPending] = useState<PendingLayout>({});

  // 拖拽回调在渲染流外触发，走 ref 读最新值
  const draftGroupsRef = useRef<ProviderGroupDefinition[]>([]);
  const pendingRef = useRef<PendingLayout>({});
  const containerOfRef = useRef<Record<string, string>>({});
  const primaryIdsRef = useRef<Set<string>>(new Set());
  const containerIdsRef = useRef<Set<string>>(new Set());
  const activeTypeRef = useRef<"card" | "group" | null>(null);
  const originPrimaryRef = useRef(false);
  const dirtyRef = useRef(false);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOverRef = useRef<string | null>(null);

  const baseLayout = useMemo(
    () => resolveGroupedLayout(groups, primaryProviders),
    [groups, primaryProviders],
  );

  // 渲染用的容器布局：拖拽中用内存态（含悬停合成的临时分组），否则用已提交定义
  const containers: GroupContainerLayout[] = useMemo(() => {
    if (!dragState) return baseLayout.containers;
    const list: GroupContainerLayout[] = draftGroups
      .filter((group) => pending[group.id])
      .map((group) => ({
        id: group.id,
        group,
        providerIds: pending[group.id],
      }));
    list.push({
      id: UNGROUPED_ID,
      group: null,
      providerIds: pending[UNGROUPED_ID] ?? [],
    });
    return list;
  }, [dragState, draftGroups, pending, baseLayout]);

  const containerOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const container of containers) {
      for (const id of container.providerIds) {
        map[id] = container.id;
      }
    }
    return map;
  }, [containers]);

  // 同步 ref（渲染后即可用；拖拽回调读的是最近一帧的值）
  containerOfRef.current = containerOf;
  primaryIdsRef.current = useMemo(
    () => new Set(primaryProviders.map((p) => p.id)),
    [primaryProviders],
  );
  containerIdsRef.current = useMemo(
    () => new Set(containers.map((c) => c.id)),
    [containers],
  );

  const clearDwell = useCallback(() => {
    if (dwellTimerRef.current !== null) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
    lastOverRef.current = null;
  }, []);

  const resetDragState = useCallback(() => {
    setDragState(null);
    setDraftGroups([]);
    draftGroupsRef.current = [];
    setPending({});
    pendingRef.current = {};
    dirtyRef.current = false;
    activeTypeRef.current = null;
    originPrimaryRef.current = false;
    clearDwell();
  }, [clearDwell]);

  const applyPending = useCallback((next: PendingLayout) => {
    pendingRef.current = next;
    dirtyRef.current = true;
    setPending(next);
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const activeId = String(event.active.id);
      const activeType =
        (event.active.data.current?.type as string | undefined) === "group"
          ? "group"
          : "card";
      const originPrimary =
        activeType === "group" ||
        containerOfRef.current[activeId] !== undefined;
      activeTypeRef.current = activeType;
      originPrimaryRef.current = originPrimary;
      const layout = resolveGroupedLayout(groups, primaryProviders);
      draftGroupsRef.current = layout.containers
        .map((c) => c.group)
        .filter((g): g is ProviderGroupDefinition => g !== null);
      pendingRef.current = layoutToPending(layout);
      dirtyRef.current = false;
      setDraftGroups(draftGroupsRef.current);
      setPending(pendingRef.current);
      setDragState({ activeId, activeType });
    },
    [groups, primaryProviders],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (activeTypeRef.current !== "card" || !originPrimaryRef.current) {
        return;
      }
      const { active, over } = event;
      if (!over) {
        clearDwell();
        return;
      }
      const activeId = String(active.id);
      const overId = String(over.id);
      if (overId === activeId) {
        clearDwell();
        return;
      }
      const overData = over.data.current as { type?: string } | undefined;
      let targetContainer: string | null = null;
      let overCardId: string | null = null;
      if (overData?.type === "card") {
        targetContainer = containerOfRef.current[overId] ?? null;
        if (targetContainer) overCardId = overId;
      } else if (overData?.type === "group" || overData?.type === "ungrouped") {
        targetContainer = overId;
      }
      if (!targetContainer) {
        clearDwell();
        return;
      }

      const currentContainer = containerOfRef.current[activeId];
      if (targetContainer !== currentContainer) {
        clearDwell();
        applyPending(
          moveProviderInPending(
            pendingRef.current,
            activeId,
            targetContainer,
            overCardId,
          ),
        );
        containerOfRef.current = {
          ...containerOfRef.current,
          [activeId]: targetContainer,
        };
      } else if (overCardId) {
        applyPending(
          moveProviderInPending(
            pendingRef.current,
            activeId,
            targetContainer,
            overCardId,
          ),
        );
        containerOfRef.current = {
          ...containerOfRef.current,
          [activeId]: targetContainer,
        };
      } else {
        // 悬停在当前容器空白处：不做位移，只保留高亮
      }

      // ─── 悬停手势（dwell）───────────────────────────────────────────
      if (
        currentContainer === UNGROUPED_ID &&
        targetContainer === UNGROUPED_ID &&
        overCardId
      ) {
        const key = `merge:${overCardId}`;
        if (lastOverRef.current !== key) {
          clearDwell();
          lastOverRef.current = key;
          dwellTimerRef.current = setTimeout(() => {
            dwellTimerRef.current = null;
            const target = overCardId;
            if (!target || target === activeId) return;
            const nextGroups = createGroupWithProviders(
              draftGroupsRef.current,
              [activeId, target],
              t("providerGroups.newGroup", { defaultValue: "新建分组" }),
            );
            const newGroupId = nextGroups[nextGroups.length - 1]?.id ?? null;
            if (!newGroupId) return;
            let next = moveProviderInPending(
              pendingRef.current,
              activeId,
              newGroupId,
              null,
            );
            next = moveProviderInPending(next, target, newGroupId, null);
            draftGroupsRef.current = nextGroups;
            setDraftGroups(nextGroups);
            applyPending(next);
            containerOfRef.current = {
              ...containerOfRef.current,
              [activeId]: newGroupId,
              [target]: newGroupId,
            };
            lastOverRef.current = null;
          }, DWELL_CREATE_GROUP_MS);
        }
        return;
      }
      if (overData?.type === "group" && input.isGroupCollapsed(overId)) {
        const key = `expand:${overId}`;
        if (lastOverRef.current !== key) {
          clearDwell();
          lastOverRef.current = key;
          dwellTimerRef.current = setTimeout(() => {
            dwellTimerRef.current = null;
            input.expandGroup(overId);
            lastOverRef.current = null;
          }, DWELL_EXPAND_GROUP_MS);
        }
        return;
      }
      clearDwell();
    },
    [applyPending, clearDwell, input, t],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const activeType = activeTypeRef.current;
      const originPrimary = originPrimaryRef.current;
      const wasDirty = dirtyRef.current;
      const pendingSnapshot = pendingRef.current;
      const draftSnapshot = draftGroupsRef.current;
      resetDragState();
      if (!activeType) return;

      if (activeType === "group") {
        if (
          over &&
          String(over.id) !== String(active.id) &&
          over.data.current?.type === "group"
        ) {
          const next = reorderGroups(
            draftSnapshot,
            String(active.id),
            String(over.id),
          );
          const layout = resolveGroupedLayout(next, primaryProviders);
          input.commitLayout(layoutToPending(layout), next);
        }
        return;
      }

      if (!originPrimary) {
        // 非主分区卡片（可添加等）：沿用平铺重排
        if (over) input.onFlatDragEnd(event);
        return;
      }
      if (wasDirty && over) {
        input.commitLayout(pendingSnapshot, draftSnapshot);
      }
    },
    [input, primaryProviders, resetDragState],
  );

  const handleDragCancel = useCallback(() => {
    resetDragState();
  }, [resetDragState]);

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeType = activeTypeRef.current;
    if (!activeType) return [];
    if (activeType === "group") {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (container) => container.data.current?.type === "group",
        ),
      });
    }
    const originPrimary = originPrimaryRef.current;
    const filtered = args.droppableContainers.filter((container) => {
      const data = container.data.current;
      if (data?.type === "group" || data?.type === "ungrouped") {
        return originPrimary;
      }
      if (data?.type === "card") {
        const isPrimary = primaryIdsRef.current.has(String(container.id));
        return originPrimary ? isPrimary : !isPrimary;
      }
      return false;
    });
    const withPointer = args.pointerCoordinates
      ? pointerWithin({ ...args, droppableContainers: filtered })
      : [];
    if (withPointer.length > 0) {
      // 卡片优先于容器：悬停卡片=插入到它前面，悬停容器空白=追加到末尾
      const cards = withPointer.filter(
        (collision) => !containerIdsRef.current.has(String(collision.id)),
      );
      return [...cards, ...withPointer.filter((c) => !cards.includes(c))];
    }
    return rectIntersection({ ...args, droppableContainers: filtered });
  }, []);

  return {
    sensors,
    collisionDetection,
    handlers: {
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
      onDragCancel: handleDragCancel,
    },
    containers,
    containerOf,
    activeDrag: dragState,
  };
}
