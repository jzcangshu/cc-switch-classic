import { useCallback, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  getFirstCollision,
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
  dissolveDragCreatedGroups,
  layoutToPending,
  mergeIntoNewGroup,
  pendingLayoutToContainers,
  planInsert,
  resolveGroupedLayout as resolveLayout,
  resolveHoverBand,
  reorderGroups,
  UNGROUPED_ID,
  type GroupContainerLayout,
  type PendingLayout,
} from "@/lib/providerGroups";

// ─── 手感参数（全部集中此处，浏览器调优轮在此微调）─────────────────────

/** 悬停才挤开：插入意图门槛（iOS 体感约半秒，鼠标场景略提速） */
export const HOVER_INSERT_MS = 250;
/** 指针移动超过该距离视为「在移动」：重置悬停计时（防慢扫假 dwell）并解除让位冻结 */
export const POINTER_MOVE_RESET_PX = 10;
/** 悬停另一张未分组卡片正中多久建组 */
export const MERGE_DWELL_MS = 450;
/** 悬停折叠分组多久自动展开 */
export const EXPAND_DWELL_MS = 400;
/** 卡片上/下边缘带占卡片高度的比例（插入 vs 建组的分界，iOS 波段语义） */
export const EDGE_BAND_RATIO = 0.25;
/** 建组命中后认领板的延迟收回（避免 B 飞入瞬间认领板 pop） */
export const MERGE_TARGET_LINGER_MS = 250;

/** 卡片位移 / FLIP / 弹回（framer spring，官方 FramerMotion 集成同款体系） */
export const CARD_SPRING = { type: "spring", stiffness: 420, damping: 36 } as const;
/** 组容器入场 / 折叠展开 */
export const GROUP_ENTER_SPRING = { type: "spring", stiffness: 320, damping: 30 } as const;
/** 拖影落位（DragOverlay dropAnimation） */
export const DROP_ANIMATION = {
  duration: 240,
  easing: "cubic-bezier(0.2, 0.8, 0.3, 1)",
} as const;

interface UseGroupDndInput {
  primaryProviders: Provider[];
  groups: ProviderGroupDefinition[];
  isGroupCollapsed: (groupId: string) => boolean;
  expandGroup: (groupId: string) => void;
  /** 唯一提交漏斗：卡片拖拽 / 分组重排都落到「内存态布局 + 分组定义」 */
  commitLayout: (
    pending: PendingLayout,
    draftGroups: ProviderGroupDefinition[],
  ) => void;
  /** 非主分区（可添加等）卡片的拖拽沿用平铺逻辑 */
  onFlatDragEnd: (event: DragEndEvent) => void;
}

/**
 * 稳定意图：同一意图持续 N ms 才产生结构变更（E1 悬停门槛）。
 * 意图一变即重置计时——扫过不打扰的全部实现。
 */
type Intent =
  | {
      kind: "insert";
      containerId: string;
      anchorId: string | null;
      position: "before" | "after";
    }
  | { kind: "merge"; anchorId: string }
  | { kind: "expand"; groupId: string };

function sameIntent(a: Intent | null, b: Intent): boolean {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === "merge" && b.kind === "merge") return a.anchorId === b.anchorId;
  if (a.kind === "expand" && b.kind === "expand") return a.groupId === b.groupId;
  if (a.kind === "insert" && b.kind === "insert") {
    return (
      a.containerId === b.containerId &&
      a.anchorId === b.anchorId &&
      a.position === b.position
    );
  }
  return false;
}

/**
 * 多容器拖拽编排（iOS 文件夹手势 v2，dnd-kit 官方多容器模式为基座）：
 * - 每容器真实 items 数组（pending），悬停到点才更新（dnd-kit + framer 平滑过渡）；
 * - DragOverlay 拖影（渲染层）：主动本体不可见，re-parent 无闪现；
 * - 卡片上/下边缘带 = 插入挪位，正中 = 建组（iOS「App 之间 vs App 之上」）；
 * - 悬停折叠分组自动展开；分组头拖动 = 分组重排；
 * - 松手一次性提交（dissolve 校验在提交前）；取消即清空内存态回 props 布局。
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
    /** 源节点宽度：拖影保宽用 */
    overlayWidth: number | null;
  } | null>(null);
  /** 拖拽内存态布局（null = 非拖拽，渲染走 props 布局） */
  const [pending, setPending] = useState<PendingLayout | null>(null);
  /** 分组定义快照（拖拽中建组会追加） */
  const [draftGroups, setDraftGroups] = useState<ProviderGroupDefinition[] | null>(
    null,
  );
  /** 认领板锚点：合并意图武装中的锚点卡（渲染层画浅色边 + 微缩） */
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  /** 当前插入/建组/展开意图的目标容器（渲染层画容器悬停高亮） */
  const [hoverContainerId, setHoverContainerId] = useState<string | null>(null);
  /** 本次拖拽中新建的分组（渲染层画新生光晕） */
  const [newbornGroupIds, setNewbornGroupIds] = useState<string[]>([]);

  // 拖拽回调在渲染流外触发，一律走 ref 读最新值
  const pendingRef = useRef<PendingLayout | null>(null);
  const draftGroupsRef = useRef<ProviderGroupDefinition[] | null>(null);
  const containerOfRef = useRef<Record<string, string>>({});
  const primaryIdsRef = useRef<Set<string>>(new Set());
  const containerIdsRef = useRef<Set<string>>(new Set());
  const activeTypeRef = useRef<"card" | "group" | null>(null);
  const originPrimaryRef = useRef(false);
  const activeIdRef = useRef<string | null>(null);
  const intentRef = useRef<Intent | null>(null);
  const intentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 碰撞阶段捕获的指针 Y（波段判定用；键盘拖拽为 null） */
  const pointerYRef = useRef<number | null>(null);
  /** 上一次指针位置（移动检测：慢扫不计时，静止才武装） */
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  /**
   * 让位冻结：fire insert 后卡片会移动，指针相对波跟着漂移（after→before→after
   * 死循环）。冻结该 anchor 的波段判定直到指针真实移动超过阈值。
   */
  const suppressAnchorRef = useRef<{ anchorId: string; position: "before" | "after" } | null>(
    null,
  );
  /** 碰撞阶段解析的锚点（over 为容器时收敛出的组内最近卡） */
  const anchorRef = useRef<{
    containerId: string;
    anchorId: string | null;
    anchorRect: { top: number; height: number } | null;
  } | null>(null);
  const lastOverIdRef = useRef<string | null>(null);
  const recentlyMovedRef = useRef(false);
  const createdGroupIdsRef = useRef<string[]>([]);

  const baseLayout = useMemo(
    () => resolveLayout(groups, primaryProviders),
    [groups, primaryProviders],
  );

  // 渲染容器：拖拽中由内存态派生（数组即真相），非拖拽走 props 布局
  const containers: GroupContainerLayout[] = useMemo(() => {
    if (!pending || !draftGroups) return baseLayout.containers;
    return pendingLayoutToContainers(draftGroups, pending, primaryProviders);
  }, [pending, draftGroups, baseLayout, primaryProviders]);

  const containerOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const container of containers) {
      for (const id of container.providerIds) {
        map[id] = container.id;
      }
    }
    return map;
  }, [containers]);

  containerOfRef.current = containerOf;
  primaryIdsRef.current = useMemo(
    () => new Set(primaryProviders.map((p) => p.id)),
    [primaryProviders],
  );
  containerIdsRef.current = useMemo(
    () => new Set(containers.map((c) => c.id)),
    [containers],
  );

  const clearIntentTimer = useCallback(() => {
    if (intentTimerRef.current !== null) {
      clearTimeout(intentTimerRef.current);
      intentTimerRef.current = null;
    }
  }, []);

  const clearLingerTimer = useCallback(() => {
    if (lingerTimerRef.current !== null) {
      clearTimeout(lingerTimerRef.current);
      lingerTimerRef.current = null;
    }
  }, []);

  const resetDragState = useCallback(() => {
    setDragState(null);
    setPending(null);
    setDraftGroups(null);
    setMergeTargetId(null);
    setHoverContainerId(null);
    setNewbornGroupIds([]);
    pendingRef.current = null;
    draftGroupsRef.current = null;
    createdGroupIdsRef.current = [];
    intentRef.current = null;
    activeIdRef.current = null;
    activeTypeRef.current = null;
    originPrimaryRef.current = false;
    anchorRef.current = null;
    lastOverIdRef.current = null;
    recentlyMovedRef.current = false;
    lastPointerRef.current = null;
    suppressAnchorRef.current = null;
    clearIntentTimer();
    clearLingerTimer();
  }, [clearIntentTimer, clearLingerTimer]);

  /** 悬停到点的执行：insert / merge / expand（全部先重校验再提交内存态） */
  const fireIntent = useCallback(
    (intent: Intent) => {
      const activeId = activeIdRef.current;
      if (!activeId) return;
      const base = pendingRef.current;
      if (!base) return;

      if (intent.kind === "insert") {
        const result = planInsert(
          base,
          activeId,
          intent.containerId,
          intent.anchorId,
          intent.position,
        );
        if (!result.changed) return;
        pendingRef.current = result.next;
        setPending(result.next);
        recentlyMovedRef.current = true;
        if (intent.anchorId) {
          suppressAnchorRef.current = { anchorId: intent.anchorId, position: intent.position };
        }
        requestAnimationFrame(() => {
          recentlyMovedRef.current = false;
        });
        return;
      }

      if (intent.kind === "merge") {
        const draft = draftGroupsRef.current;
        if (!draft) return;
        const result = mergeIntoNewGroup(
          draft,
          base,
          activeId,
          intent.anchorId,
          t("providerGroups.newGroup", { defaultValue: "新建分组" }),
        );
        if (!result) return;
        draftGroupsRef.current = result.groups;
        pendingRef.current = result.pending;
        createdGroupIdsRef.current.push(result.newGroupId);
        setDraftGroups(result.groups);
        setPending(result.pending);
        setNewbornGroupIds((prev) =>
          prev.includes(result.newGroupId) ? prev : [...prev, result.newGroupId],
        );
        // 认领板延迟收回：与组容器入场光晕衔接，避免 B 飞入瞬间板子 pop
        const anchor = intent.anchorId;
        lingerTimerRef.current = setTimeout(() => {
          lingerTimerRef.current = null;
          setMergeTargetId((current) => (current === anchor ? null : current));
        }, MERGE_TARGET_LINGER_MS);
        return;
      }

      input.expandGroup(intent.groupId);
    },
    [input, t],
  );

  /** 武装意图：意图相同计时继续，不同则重置（E1 的全部实现） */
  const armIntent = useCallback(
    (intent: Intent) => {
      if (sameIntent(intentRef.current, intent)) return;
      clearIntentTimer();
      intentRef.current = intent;
      const delay =
        intent.kind === "insert"
          ? HOVER_INSERT_MS
          : intent.kind === "merge"
            ? MERGE_DWELL_MS
            : EXPAND_DWELL_MS;
      intentTimerRef.current = setTimeout(() => {
        intentTimerRef.current = null;
        const armed = intentRef.current;
        intentRef.current = null;
        if (armed) fireIntent(armed);
      }, delay);
      if (intent.kind === "merge") {
        setMergeTargetId(intent.anchorId);
        setHoverContainerId(UNGROUPED_ID);
      } else if (intent.kind === "insert") {
        setMergeTargetId(null);
        setHoverContainerId(intent.containerId);
      } else {
        setMergeTargetId(null);
        setHoverContainerId(intent.groupId);
      }
    },
    [clearIntentTimer, fireIntent],
  );

  const disarmIntent = useCallback(() => {
    clearIntentTimer();
    intentRef.current = null;
    setMergeTargetId(null);
    setHoverContainerId(null);
  }, [clearIntentTimer]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const activeId = String(event.active.id);
      const activeType =
        (event.active.data.current?.type as string | undefined) === "group"
          ? "group"
          : "card";
      activeTypeRef.current = activeType;
      originPrimaryRef.current =
        activeType === "group" ||
        containerOfRef.current[activeId] !== undefined;
      activeIdRef.current = activeId;
      const layout = resolveLayout(groups, primaryProviders);
      const initialPending = layoutToPending(layout);
      draftGroupsRef.current = groups;
      pendingRef.current = initialPending;
      createdGroupIdsRef.current = [];
      intentRef.current = null;
      // 拖影宽度：DragOverlay 是 fixed shrink-to-fit，不给宽度会塌缩成窄条
      const initialRect = event.active.rect.current.initial;
      setDragState({
        activeId,
        activeType,
        overlayWidth: initialRect ? initialRect.width : null,
      });
      setDraftGroups(groups);
      setPending(initialPending);
    },
    [groups, primaryProviders],
  );

  /**
   * 意图武装（波段 / 建组 / 展开 / 插入）挂在碰撞检测的同步路径上：
   * dnd-kit 的 onDragOver 只在 over 变化时派发（指针在同一张卡上从边缘滑到
   * 中心不触发），onDragMove 又是异步 effect（合成事件流下派发不可靠）——
   * 只有 collisionDetection 每次传感器移动都会同步执行，anchor / 波段的
   * 更新放这里才能保证「最后一次移动的位置」总是被解析。
   * 由 collisionDetection 在存好 anchorRef 后调用。
   */
  const updateIntentFromOver = useCallback(
    (overId: string, overType: string | undefined, activeId: string) => {
      let containerId: string | null = null;
      let anchorId: string | null = null;
      let anchorRect: { top: number; height: number } | null = null;
      if (overType === "card") {
        containerId = containerOfRef.current[overId] ?? null;
        if (containerId) {
          anchorId = overId;
          if (anchorRef.current?.anchorId === overId) {
            anchorRect = anchorRef.current.anchorRect;
          }
        }
      } else if (overType === "group" || overType === "ungrouped") {
        containerId = overId;
        // 锚点取碰撞阶段收敛出的容器内最近卡
        if (anchorRef.current?.containerId === overId) {
          anchorId = anchorRef.current.anchorId;
          anchorRect = anchorRef.current.anchorRect;
        }
      }
      if (!containerId) {
        disarmIntent();
        return;
      }

      // 悬停折叠分组 → 展开意图
      if (overType === "group" && input.isGroupCollapsed(overId)) {
        armIntent({ kind: "expand", groupId: overId });
        return;
      }

      // 波段判定：上/下边缘带 = 插入，正中 = 建组（iOS「App 之间 vs App 之上」）
      // 让位冻结：fire 后卡片在动，指针相对波会漂移——维持已 fire 的意图直到指针真移动
      const suppressed =
        suppressAnchorRef.current &&
        suppressAnchorRef.current.anchorId === anchorId
          ? suppressAnchorRef.current
          : null;
      const band = suppressed
        ? suppressed.position
        : resolveHoverBand(pointerYRef.current, anchorRect, EDGE_BAND_RATIO);
      const activeContainer = containerOfRef.current[activeId] ?? null;
      const mergeable =
        band === "middle" &&
        !suppressed &&
        anchorId != null &&
        anchorId !== activeId &&
        activeContainer === UNGROUPED_ID &&
        containerId === UNGROUPED_ID;
      if (mergeable) {
        armIntent({ kind: "merge", anchorId: anchorId! });
        return;
      }

      // 插入意图：边缘带按波段；中带不可合并时按指针与锚点卡中线的相对位置定方向
      let position: "before" | "after";
      if (band === "before") {
        position = "before";
      } else if (band === "after") {
        position = "after";
      } else {
        position =
          pointerYRef.current != null &&
          anchorRect != null &&
          pointerYRef.current > anchorRect.top + anchorRect.height / 2
            ? "after"
            : "before";
      }
      armIntent({ kind: "insert", containerId, anchorId, position });
    },
    [armIntent, disarmIntent, input],
  );

  /** over 消失（拖出有效区）时清意图与高亮；意图武装在碰撞检测同步路径上 */
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (activeTypeRef.current !== "card" || !originPrimaryRef.current) return;
      if (!event.over) {
        disarmIntent();
      }
    },
    [disarmIntent],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const activeType = activeTypeRef.current;
      const originPrimary = originPrimaryRef.current;
      const activeId = activeIdRef.current;
      const pendingNow = pendingRef.current;
      const draftNow = draftGroupsRef.current;
      const created = [...createdGroupIdsRef.current];
      resetDragState();
      if (!activeType || !activeId) return;

      if (activeType === "group") {
        if (
          over &&
          String(over.id) !== String(active.id) &&
          over.data.current?.type === "group" &&
          draftNow
        ) {
          const next = reorderGroups(draftNow, activeId, String(over.id));
          input.commitLayout(pendingNow ?? layoutToPending(baseLayout), next);
        }
        return;
      }

      if (!originPrimary) {
        // 非主分区卡片（可添加等）：沿用平铺重排
        if (over) input.onFlatDragEnd(event);
        return;
      }

      if (!over || !pendingNow || !draftNow) {
        // 无效落点 / 拖出有效区：内存态已在 reset 清空，渲染回 props 布局，
        // 新建组的消失由渲染层 AnimatePresence exit 幽灵式消散
        return;
      }

      // dissolve：本次新建的组里 A 不在其中的 → 组消散、成员退回未分组头部
      let finalPending = pendingNow;
      let finalGroups = draftNow;
      const doomed = created.filter(
        (groupId) => !(finalPending[groupId] ?? []).includes(activeId),
      );
      if (doomed.length > 0) {
        const result = dissolveDragCreatedGroups(finalGroups, finalPending, doomed);
        finalGroups = result.groups;
        finalPending = result.pending;
      }
      input.commitLayout(finalPending, finalGroups);
    },
    [baseLayout, input, resetDragState],
  );

  const handleDragCancel = useCallback(() => {
    resetDragState();
  }, [resetDragState]);

  /**
   * 碰撞检测（官方 MultipleContainers 同构 + type 过滤）：
   * pointerWithin → rectIntersection 兜底；容器命中收敛到组内最近卡；
   * lastOverId + recentlyMoved 修正在 items 变化后 over 瞬断的抖动。
   */
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointer = args.pointerCoordinates;
    pointerYRef.current = pointer?.y ?? null;
    // 移动检测：慢扫不计时（重置当前意图的计时），并解除让位冻结
    if (pointer) {
      const last = lastPointerRef.current;
      if (
        last &&
        Math.hypot(pointer.x - last.x, pointer.y - last.y) > POINTER_MOVE_RESET_PX
      ) {
        suppressAnchorRef.current = null;
        if (intentRef.current && intentTimerRef.current !== null) {
          const armed = intentRef.current;
          const delay =
            armed.kind === "insert"
              ? HOVER_INSERT_MS
              : armed.kind === "merge"
                ? MERGE_DWELL_MS
                : EXPAND_DWELL_MS;
          clearIntentTimer();
          intentTimerRef.current = setTimeout(() => {
            intentTimerRef.current = null;
            const pendingIntent = intentRef.current;
            intentRef.current = null;
            if (pendingIntent) fireIntent(pendingIntent);
          }, delay);
        }
      }
      lastPointerRef.current = pointer;
    }
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

    const pointerIntersections = pointerWithin({
      ...args,
      droppableContainers: filtered,
    });
    const intersections =
      pointerIntersections.length > 0
        ? pointerIntersections
        : rectIntersection({ ...args, droppableContainers: filtered });
    if (intersections.length === 0) {
      if (recentlyMovedRef.current && activeIdRef.current) {
        lastOverIdRef.current = activeIdRef.current;
      }
      return lastOverIdRef.current ? [{ id: lastOverIdRef.current }] : [];
    }

    const first = getFirstCollision(intersections, "id");
    if (first == null) return [];
    const overId = String(first);
    const overType = args.droppableContainers.find(
      (container) => String(container.id) === overId,
    )?.data.current?.type as string | undefined;

    // 容器命中：收敛到容器内最近卡（悬停容器空白 = 落到最近卡处）
    if (containerIdsRef.current.has(overId)) {
      const memberIds = pendingRef.current?.[overId] ?? [];
      const inner = closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((container) =>
          memberIds.includes(String(container.id)),
        ),
      });
      if (inner.length > 0 && inner[0]) {
        const anchorId = String(inner[0].id);
        const anchorContainer = args.droppableContainers.find(
          (container) => String(container.id) === anchorId,
        );
        const rect = anchorContainer?.rect.current ?? null;
        anchorRef.current = {
          containerId: overId,
          anchorId,
          anchorRect: rect ? { top: rect.top, height: rect.height } : null,
        };
        lastOverIdRef.current = anchorId;
        // 意图武装（碰撞检测是每次传感器移动的同步路径）
        if (
          activeTypeRef.current === "card" &&
          originPrimaryRef.current &&
          activeIdRef.current
        ) {
          updateIntentFromOver(overId, overType, activeIdRef.current);
        }
        return [...inner];
      }
      anchorRef.current = {
        containerId: overId,
        anchorId: null,
        anchorRect: null,
      };
      lastOverIdRef.current = overId;
      if (
        activeTypeRef.current === "card" &&
        originPrimaryRef.current &&
        activeIdRef.current
      ) {
        updateIntentFromOver(overId, overType, activeIdRef.current);
      }
      return [{ id: overId }];
    }

    // 卡片命中：卡片优先于容器返回
    const hitContainer = args.droppableContainers.find(
      (container) => String(container.id) === overId,
    );
    const rect = hitContainer?.rect.current ?? null;
    anchorRef.current = {
      containerId: containerOfRef.current[overId] ?? null,
      anchorId: overId,
      anchorRect: rect ? { top: rect.top, height: rect.height } : null,
    };
    lastOverIdRef.current = overId;
    if (
      activeTypeRef.current === "card" &&
      originPrimaryRef.current &&
      activeIdRef.current &&
      overId !== activeIdRef.current
    ) {
      updateIntentFromOver(overId, overType, activeIdRef.current);
    }
    const cards = intersections.filter(
      (collision) => !containerIdsRef.current.has(String(collision.id)),
    );
    return [...cards, ...intersections.filter((c) => !cards.includes(c))];
  }, [updateIntentFromOver]);

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
    mergeTargetId,
    hoverContainerId,
    newbornGroupIds,
  };
}
