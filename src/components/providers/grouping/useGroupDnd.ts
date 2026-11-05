import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  moveProviderInPending,
  pendingLayoutToContainers,
  planInsert,
  previewGroupSlotIndex,
  resolveGroupedLayout as resolveLayout,
  resolveHoverBand,
  reorderGroups,
  UNGROUPED_ID,
  type GroupContainerLayout,
  type PendingLayout,
} from "@/lib/providerGroups";

import { DROP_ANIMATION } from "./groupMotion";

// ─── 手感参数（全部集中此处，浏览器调优轮在此微调）─────────────────────

/** 悬停才挤开：插入意图门槛（挪位跟手优先，iOS 体感的三分之二速） */
export const HOVER_INSERT_MS = 300;
/** 指针移动超过该距离视为「在移动」：重置悬停计时（防慢扫假 dwell）并解除意图锁定 */
export const POINTER_MOVE_RESET_PX = 10;
/** 精确重叠（卡片正中带）悬停多久建组 */
export const MERGE_DWELL_MS = 450;
/** 模糊重叠带悬停多久才允许建组（明显更久，防误触） */
export const MERGE_NEAR_DWELL_MS = 1100;
/** 悬停折叠分组多久自动展开 */
export const EXPAND_DWELL_MS = 400;
/**
 * 卡片上/下边缘带占卡片高度的比例（插入挪位 vs 建组的分界）。
 * 对齐 iOS「悬停 App 本体 = 进文件夹、悬停 App 之间 = 挪位」：
 * 建组判定收在卡片正中带，缝隙一侧留给挪位。
 */
export const EDGE_BAND_RATIO = 0.18;
/** 卡片正中 ± 该比例算精确重叠（几乎完全叠上，快速触发建组） */
export const EXACT_BAND_RATIO = 0.1;

interface UseGroupDndInput {
  reducedMotion?: boolean;
  primaryProviders: Provider[];
  groups: ProviderGroupDefinition[];
  isGroupCollapsed: (groupId: string) => boolean;
  setGroupCollapsed: (groupId: string, collapsed: boolean) => void;
  /** 唯一提交漏斗：卡片拖拽 / 分组重排都落到「内存态布局 + 分组定义」 */
  commitLayout: (
    pending: PendingLayout,
    draftGroups: ProviderGroupDefinition[],
  ) => Promise<boolean>;
  /** 非主分区（可添加等）卡片的拖拽沿用平铺逻辑 */
  onFlatDragEnd: (event: DragEndEvent) => void;
}

/**
 * 稳定意图：同一意图持续 N ms 才产生结构变更（E1 悬停门槛）。
 * 意图一变即重置计时——扫过不打扰的全部实现。
 * merge 带 exact：精确重叠（卡片正中）短门槛快速触发，模糊重叠长门槛
 * 防误触（iOS 两级触发语义）。
 */
type Intent =
  | {
      kind: "insert";
      containerId: string;
      anchorId: string | null;
      position: "before" | "after";
    }
  | { kind: "merge"; anchorId: string; exact: boolean }
  | { kind: "expand"; groupId: string };

function sameIntent(a: Intent | null, b: Intent): boolean {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === "merge" && b.kind === "merge") {
    return a.anchorId === b.anchorId && a.exact === b.exact;
  }
  if (a.kind === "expand" && b.kind === "expand")
    return a.groupId === b.groupId;
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
 * 落位保持判定：props 的布局是否已经追上松手时提交的 pending。
 * 只比较「有成员的组 + 未分组」，空组/被删组不参与，避免服务端归一化后永不相等。
 */
function layoutMatchesPending(
  containers: GroupContainerLayout[],
  pending: PendingLayout,
  groups: ProviderGroupDefinition[],
): boolean {
  const required = new Set<string>([UNGROUPED_ID]);
  for (const group of groups) {
    if ((pending[group.id] ?? []).length > 0) required.add(group.id);
  }
  const expectedGroups = groups
    .filter((group) => required.has(group.id))
    .map((group) => group.id);
  const actualGroups = containers
    .filter((container) => container.group && container.providerIds.length > 0)
    .map((container) => container.id);
  if (expectedGroups.join("\0") !== actualGroups.join("\0")) return false;
  const containerIds = new Set(containers.map((container) => container.id));
  if ([...required].some((id) => !containerIds.has(id))) return false;
  return containers.every((container) => {
    const held = pending[container.id] ?? [];
    return (
      held.length === container.providerIds.length &&
      held.every((id, index) => id === container.providerIds[index])
    );
  });
}

/** 意图到门槛时长的统一映射（武装 / 移动重置计时共用） */
function intentDelay(intent: Intent): number {
  switch (intent.kind) {
    case "insert":
      return HOVER_INSERT_MS;
    case "merge":
      return intent.exact ? MERGE_DWELL_MS : MERGE_NEAR_DWELL_MS;
    case "expand":
      return EXPAND_DWELL_MS;
  }
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
    /** 源节点高度：分组缝隙占位用 */
    overlayHeight: number | null;
  } | null>(null);
  /** 拖拽内存态布局（null = 非拖拽，渲染走 props 布局） */
  const [pending, setPending] = useState<PendingLayout | null>(null);
  /** 分组定义快照（拖拽中建组会追加） */
  const [draftGroups, setDraftGroups] = useState<
    ProviderGroupDefinition[] | null
  >(null);
  /** 认领板锚点：合并意图武装中的锚点卡（渲染层画灰色底板 + 微缩） */
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  /**
   * 就地建组预览：merge fire 后新组先渲染在锚点卡 B 原来的未分组位置
   * （iOS 文件夹在 App 原位弹出的同款语义）。松手前保持就地不动，
   * 拖影落位完成后在同一列表内移动到分组区，保持组节点及成员身份。
   */
  const [previewGroup, setPreviewGroup] = useState<{
    groupId: string;
    slotIndex: number;
    anchorId: string;
  } | null>(null);
  /** previewGroup 的 ref 镜像（dragEnd 读最新值） */
  const previewGroupRef = useRef<{
    groupId: string;
    slotIndex: number;
    anchorId: string;
  } | null>(null);
  /**
   * 分组缝隙占位：把卡片拖到两组之间的留白时，在缝隙处预览一个落点，
   * 松手后卡片才归入「未分组」头部（拖拽中不移动真卡，避免其他卡片抢跑）。
   */
  const [gapPreview, setGapPreview] = useState<{
    beforeGroupId: string;
  } | null>(null);
  const gapPreviewRef = useRef<{ beforeGroupId: string } | null>(null);
  /**
   * 松手后的落位布局保持：drop 当帧分组/排序的乐观更新可能还没同步到 props，
   * 若立即清空 pending，卡片会按旧布局先弹回原位、下一帧再闪到目标位置。
   * 保持最终布局直到拖影落位且 props 追上再释放。
   */
  const [postDropLayout, setPostDropLayout] = useState<{
    pending: PendingLayout;
    groups: ProviderGroupDefinition[];
  } | null>(null);
  /**
   * 落位安定：松手后 dropAnimation 飞行期间，真卡冻结在最终布局位
   * （不做 framer FLIP、保持隐藏）。否则 dropAnimation 的目标快照会取到
   * FLIP 中间态 rect，动画结束 overlay 与真卡位置不重合 = 位置跳变。
   */
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const elevationAfterDropRef = useRef<(() => void) | null>(null);
  /** 碰撞阶段捕获的指针 Y（波段判定用；键盘拖拽为 null） */
  const pointerYRef = useRef<number | null>(null);
  const keyboardDragRef = useRef(false);
  // 碰撞在 DndContext 渲染期间执行；视觉状态只在随后传感器事件提交时更新。
  const hoverEffectsRef = useRef<Array<() => void>>([]);
  const applyHoverEffects = useCallback(() => {
    const effects = hoverEffectsRef.current;
    hoverEffectsRef.current = [];
    effects.forEach((effect) => effect());
  }, []);
  const dragSequenceRef = useRef(0);
  const [dragSequence, setDragSequence] = useState(0);
  /** 上一次指针位置（移动检测：慢扫不计时，静止才武装） */
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  /**
   * 意图锁定（iOS 让位语义的核心）：任何意图 fire 之后，卡片在动、指针相对
   * 波段与 over 都会漂移（挤开 → 指针下的卡换成下一张 → 又武装 → 蠕动；
   * 动画中的 rect 过期 → 缝隙误判成中带）。锁定期间不再武装任何新意图，
   * 让位位置保持稳定，直到指针真实移动超过阈值。
   */
  const intentLockedRef = useRef(false);
  /** 拖拽开始时的初始布局（松手时 dirty 检查：fire 过才提交） */
  const initialPendingRef = useRef<PendingLayout | null>(null);
  /** 碰撞阶段解析的锚点（over 为容器时收敛出的组内最近卡） */
  const anchorRef = useRef<{
    containerId: string;
    anchorId: string | null;
    anchorRect: { top: number; height: number } | null;
  } | null>(null);
  const lastOverIdRef = useRef<string | null>(null);
  const recentlyMovedRef = useRef(false);
  const createdGroupIdsRef = useRef<string[]>([]);
  const expandedDuringDragRef = useRef(new Set<string>());

  const baseLayout = useMemo(
    () => resolveLayout(groups, primaryProviders),
    [groups, primaryProviders],
  );

  // 渲染容器：拖拽中由内存态派生（数组即真相）；松手后先按住最终布局，
  // 等 props 追上提交结果再切回 baseLayout；其余情况走 props 布局
  const containers: GroupContainerLayout[] = useMemo(() => {
    if (pending && draftGroups) {
      return pendingLayoutToContainers(draftGroups, pending, primaryProviders);
    }
    if (postDropLayout) {
      return pendingLayoutToContainers(
        postDropLayout.groups,
        postDropLayout.pending,
        primaryProviders,
      );
    }
    return baseLayout.containers;
  }, [pending, draftGroups, postDropLayout, baseLayout, primaryProviders]);

  // 拖影与真实数据都完成才交还布局，防止空组提前收拢改变飞行中的目标。
  useEffect(() => {
    if (!postDropLayout || dragState || settlingId) return;
    if (
      layoutMatchesPending(
        baseLayout.containers,
        postDropLayout.pending,
        postDropLayout.groups,
      )
    ) {
      setPostDropLayout(null);
    }
  }, [postDropLayout, dragState, settlingId, baseLayout]);

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

  const clearPendingElevation = useCallback(() => {
    elevationAfterDropRef.current = null;
  }, []);

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  // 挂载/卸载双向清理 settling：Fast Refresh 会保留 state，残留 settlingId
  // 会让卡片一直停在 opacity:0；卸载时清空全部定时器，残留回调不得再改状态
  useEffect(() => {
    setSettlingId(null);
    return () => {
      clearIntentTimer();
      clearPendingElevation();
      clearSettleTimer();
    };
  }, [clearIntentTimer, clearPendingElevation, clearSettleTimer]);

  const finishDropAnimation = useCallback(
    (sequence = dragSequenceRef.current) => {
      // 旧拖影可能在下一次拖动后才完成；它不能解冻新拖影或触发新组升格。
      if (sequence !== dragSequenceRef.current) return;
      clearSettleTimer();
      setSettlingId(null);
      const elevate = elevationAfterDropRef.current;
      elevationAfterDropRef.current = null;
      elevate?.();
    },
    [clearSettleTimer],
  );

  /** 正常由动画完成事件解冻；定时器只防守浏览器未交付动画的异常路径。 */
  const beginSettling = useCallback(
    (activeId: string) => {
      clearSettleTimer();
      if (input.reducedMotion) return;
      setSettlingId(activeId);
      settleTimerRef.current = setTimeout(
        finishDropAnimation,
        DROP_ANIMATION.duration + 160,
      );
    },
    [clearSettleTimer, finishDropAnimation, input.reducedMotion],
  );

  const endSettling = useCallback(() => {
    clearSettleTimer();
    clearPendingElevation();
    setSettlingId(null);
  }, [clearSettleTimer, clearPendingElevation]);

  /** 同一提交入口保持最终布局，失败只撤回这一次提交，不影响后续操作。 */
  const commitHeldLayout = useCallback(
    async (
      nextPending: PendingLayout,
      nextGroups: ProviderGroupDefinition[],
    ) => {
      const held = { pending: nextPending, groups: nextGroups };
      setPostDropLayout(held);
      if (!(await input.commitLayout(nextPending, nextGroups))) {
        setPostDropLayout((current) => (current === held ? null : current));
      }
    },
    [input.commitLayout],
  );

  const showGapPreview = useCallback((beforeGroupId: string) => {
    if (gapPreviewRef.current?.beforeGroupId === beforeGroupId) return;
    gapPreviewRef.current = { beforeGroupId };
    setGapPreview({ beforeGroupId });
  }, []);

  const clearGapPreview = useCallback(() => {
    gapPreviewRef.current = null;
    setGapPreview(null);
  }, []);

  const resetDragState = useCallback(
    (keepPreview = false) => {
      setDragState(null);
      setPending(null);
      setDraftGroups(null);
      setMergeTargetId(null);
      setPostDropLayout(null);
      // 新拖拽 / 取消 / 结束时必须解除上一轮的 settling 冻结，
      // 否则旧 settlingId 会让对应卡片一直停在 opacity:0
      endSettling();
      hoverEffectsRef.current = [];
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
      intentLockedRef.current = false;
      initialPendingRef.current = null;
      clearIntentTimer();
      gapPreviewRef.current = null;
      setGapPreview(null);
      if (!keepPreview) {
        setPreviewGroup(null);
        previewGroupRef.current = null;
        clearPendingElevation();
      }
    },
    [clearIntentTimer, clearPendingElevation, endSettling],
  );

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
        // 意图锁定：让位发生后位置保持稳定，直到指针真实移动（见 intentLockedRef）
        intentLockedRef.current = true;
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
        intentLockedRef.current = true;
        // 就地预览：新组先渲染在 B 原来的未分组位置。松手前禁止上移
        //（预览框保持原位），拖影完成后整体升入分组区（见 handleDragEnd）
        // 槽位按「移除 B/C 后剩下多少卡」算，避免预览组插到 D 之后。
        const slotIndex = previewGroupSlotIndex(
          base,
          activeId,
          intent.anchorId,
        );
        previewGroupRef.current = {
          groupId: result.newGroupId,
          slotIndex,
          anchorId: intent.anchorId,
        };
        setPreviewGroup(previewGroupRef.current);
        // 提示背景的身份交给新组，旧提示不再在组内额外挂载。
        setMergeTargetId(null);
        lastOverIdRef.current = result.newGroupId;
        return;
      }

      intentLockedRef.current = true;
      expandedDuringDragRef.current.add(intent.groupId);
      input.setGroupCollapsed(intent.groupId, false);
    },
    [clearPendingElevation, input, t],
  );

  /** 武装意图：意图相同计时继续，不同则重置（E1 的全部实现） */
  const armIntent = useCallback(
    (intent: Intent) => {
      if (sameIntent(intentRef.current, intent)) return;
      clearIntentTimer();
      intentRef.current = intent;
      intentTimerRef.current = setTimeout(() => {
        intentTimerRef.current = null;
        const armed = intentRef.current;
        intentRef.current = null;
        if (armed) fireIntent(armed);
      }, intentDelay(intent));
      // 唯一的视觉指引：建组武装（模糊/精确重叠）时锚点卡浮出灰色认领板；
      // 拖走即收回。其余意图无任何指示。
      setMergeTargetId(intent.kind === "merge" ? intent.anchorId : null);
    },
    [clearIntentTimer, fireIntent],
  );

  const disarmIntent = useCallback(() => {
    clearIntentTimer();
    intentRef.current = null;
    setMergeTargetId(null);
  }, [clearIntentTimer]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      resetDragState();
      setDragSequence(++dragSequenceRef.current);
      expandedDuringDragRef.current.clear();
      keyboardDragRef.current = event.activatorEvent?.type === "keydown";
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
      initialPendingRef.current = initialPending;
      createdGroupIdsRef.current = [];
      intentRef.current = null;
      intentLockedRef.current = false;
      // 拖影宽度：DragOverlay 是 fixed shrink-to-fit，不给宽度会塌缩成窄条
      const initialRect = event.active.rect.current.initial;
      setDragState({
        activeId,
        activeType,
        overlayWidth: initialRect ? initialRect.width : null,
        overlayHeight: initialRect ? initialRect.height : null,
      });
      setDraftGroups(groups);
      setPending(initialPending);
    },
    [resetDragState, groups, primaryProviders],
  );

  /** 碰撞阶段记录锚点，传感器事件提交后再武装意图，避免渲染期间修改组件状态。 */
  const updateIntentFromOver = useCallback(
    (overId: string, overType: string | undefined, activeId: string) => {
      // 意图锁定：让位发生后的位置保持稳定，直到指针真实移动（见 intentLockedRef）
      if (intentLockedRef.current) return;
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

      // 波段判定（iOS 两级触发）：
      // 边缘带（缝隙一侧）= 插入挪位；模糊重叠 = 认领板预备 + 超久才建组；
      // 精确重叠（卡片正中）= 认领板 + 快速建组。拖走随时解除预备。
      const band = resolveHoverBand(
        pointerYRef.current,
        anchorRect,
        EDGE_BAND_RATIO,
        EXACT_BAND_RATIO,
      );
      const activeContainer = containerOfRef.current[activeId] ?? null;
      const mergeable =
        (band === "near" || band === "exact") &&
        anchorId != null &&
        anchorId !== activeId &&
        activeContainer === UNGROUPED_ID &&
        containerId === UNGROUPED_ID;
      if (mergeable) {
        armIntent({
          kind: "merge",
          anchorId: anchorId!,
          exact: band === "exact",
        });
        return;
      }

      // 插入意图：边缘带按波段；重叠带不可合并时按指针与锚点卡中线的相对位置定方向
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
      applyHoverEffects();
      if (activeTypeRef.current !== "card" || !originPrimaryRef.current) return;
      if (!event.over) {
        disarmIntent();
      }
    },
    [disarmIntent, applyHoverEffects],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      applyHoverEffects();
      const { active, over } = event;
      // 快照必须在 reset 前取全
      const activeType = activeTypeRef.current;
      const originPrimary = originPrimaryRef.current;
      const activeId = activeIdRef.current;
      const armedIntent = intentRef.current;
      const keyboardDrag = keyboardDragRef.current;
      const pendingNow = pendingRef.current;
      const draftNow = draftGroupsRef.current;
      const initial = initialPendingRef.current;
      const created = [...createdGroupIdsRef.current];
      const hadPreview = previewGroupRef.current !== null;
      const hadGapPreview = gapPreviewRef.current !== null;
      // 保留就地预览（拖影完成后才整体升组），其余拖拽态全部复位
      resetDragState(true);
      if (!activeType || !activeId) return;

      /** 拖影落位完成后移动同一个组节点，不跨树重挂或增加高度占位 */
      const schedulePreviewElevation = () => {
        if (!hadPreview) return;
        clearPendingElevation();
        elevationAfterDropRef.current = () => {
          const preview = previewGroupRef.current;
          if (!preview) return;
          setPreviewGroup(null);
          previewGroupRef.current = null;
        };
        if (input.reducedMotion) finishDropAnimation();
      };

      if (activeType === "group") {
        if (
          over &&
          String(over.id) !== String(active.id) &&
          over.data.current?.type === "group" &&
          draftNow &&
          pendingNow
        ) {
          const next = reorderGroups(draftNow, activeId, String(over.id));
          // 落位保持 + 分组冻结：等分组定义的乐观更新同步到 props 再释放，
          // 并让真组等拖影落位完成后再现身（避免松手瞬间全尺寸组闪现）
          beginSettling(activeId);
          void commitHeldLayout(pendingNow, next);
        }
        schedulePreviewElevation();
        return;
      }

      // 卡片拖拽统一进入落位安定：dropAnimation 飞行期间真卡冻结在最终位
      beginSettling(activeId);

      if (!originPrimary) {
        // 非主分区卡片（可添加等）：沿用平铺重排
        if (over) input.onFlatDragEnd(event);
        return;
      }

      if (!pendingNow || !draftNow || !initial) {
        return;
      }

      // 松手即落位（iOS 语义）：武装中的插入意图无需等悬停门槛，立即生效。
      // 悬停门槛只决定「让位动画」何时发生，不是落位的前提——否则快速
      // 挪位（到位即松）永远赶不上 fire，卡片弹回原位。
      let effectivePending = pendingNow;
      if (keyboardDrag && over && String(over.id) !== activeId) {
        const targetId = String(over.id);
        const targetContainer = containerOfRef.current[targetId];
        if (targetContainer)
          effectivePending = moveProviderInPending(
            effectivePending,
            activeId,
            targetContainer,
            targetId,
          );
      }
      if (armedIntent?.kind === "insert") {
        const dropResult = planInsert(
          effectivePending,
          activeId,
          armedIntent.containerId,
          armedIntent.anchorId,
          armedIntent.position,
        );
        if (dropResult.changed) {
          effectivePending = dropResult.next;
        }
      }

      // 缝隙占位中松手：真卡在拖拽期间未移动，最终一次性归入未分组头部
      if (hadGapPreview) {
        const next: PendingLayout = {};
        for (const [key, ids] of Object.entries(effectivePending)) {
          next[key] = ids.filter((id) => id !== activeId);
        }
        next[UNGROUPED_ID] = [
          activeId,
          ...(next[UNGROUPED_ID] ?? []).filter((id) => id !== activeId),
        ];
        effectivePending = next;
      }

      // dirty 检查：落位计算后布局仍与初始一致 → 无事发生（含中带松手不建组）
      const dirty =
        Object.keys(effectivePending).length !== Object.keys(initial).length ||
        Object.keys(effectivePending).some(
          (key) =>
            (effectivePending[key] ?? []).join("\u0000") !==
            (initial[key] ?? []).join("\u0000"),
        );
      if (!dirty) {
        schedulePreviewElevation();
        return;
      }

      // dissolve：本次新建的组里 A 不在其中的 → 组消散、成员退回未分组头部
      let finalPending = effectivePending;
      let finalGroups = draftNow;
      const doomed = created.filter(
        (groupId) => !(finalPending[groupId] ?? []).includes(activeId),
      );
      if (doomed.length > 0) {
        const result = dissolveDragCreatedGroups(
          finalGroups,
          finalPending,
          doomed,
        );
        finalGroups = result.groups;
        finalPending = result.pending;
        // 组要消散了：就地预览立即拆掉（iOS 预览消散语义）
        clearPendingElevation();
        setPreviewGroup(null);
        previewGroupRef.current = null;
      }
      // 落位保持：提交后的乐观更新可能晚于本次渲染到达 props；
      // 先按住最终布局，防止卡片按旧布局弹回原位再闪到目标位置
      void commitHeldLayout(finalPending, finalGroups);
      schedulePreviewElevation();
    },
    [
      applyHoverEffects,
      beginSettling,
      commitHeldLayout,
      clearPendingElevation,
      input,
      resetDragState,
      finishDropAnimation,
    ],
  );

  const handleDragCancel = useCallback(() => {
    // 取消无 dropAnimation：真卡正常 FLIP 弹回，不进入安定冻结
    // （resetDragState 内部已 endSettling，含清定时器）
    resetDragState();
    for (const id of expandedDuringDragRef.current)
      input.setGroupCollapsed(id, true);
    expandedDuringDragRef.current.clear();
  }, [resetDragState, input]);

  /**
   * 碰撞检测（官方 MultipleContainers 同构 + type 过滤）：
   * pointerWithin → rectIntersection 兜底；容器命中收敛到组内最近卡；
   * lastOverId + recentlyMoved 修正在 items 变化后 over 瞬断的抖动。
   */
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const effects: Array<() => void> = [];
      hoverEffectsRef.current = effects;
      const pointer = args.pointerCoordinates;
      pointerYRef.current = pointer?.y ?? null;
      effects.push(() => {
        // 移动检测：真实移动才解除意图锁定 + 重置武装中意图的计时（慢扫不 fire）
        if (pointer) {
          const last = lastPointerRef.current;
          if (
            last &&
            Math.hypot(pointer.x - last.x, pointer.y - last.y) >
              POINTER_MOVE_RESET_PX
          ) {
            intentLockedRef.current = false;
            if (intentRef.current && intentTimerRef.current !== null) {
              const armed = intentRef.current;
              clearIntentTimer();
              intentTimerRef.current = setTimeout(() => {
                intentTimerRef.current = null;
                const pendingIntent = intentRef.current;
                intentRef.current = null;
                if (pendingIntent) fireIntent(pendingIntent);
              }, intentDelay(armed));
            }
          }
          // 以本次稳定停留的起点累计距离，不能每一帧重置，否则慢移永远达不到阈值。
          if (
            !last ||
            Math.hypot(pointer.x - last.x, pointer.y - last.y) >
              POINTER_MOVE_RESET_PX
          ) {
            lastPointerRef.current = pointer;
          }
        }
      });
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

      // 键盘只选择明确卡片落点，松手按数组方向插入，不启动悬停建组/展开计时。
      if (keyboardDragRef.current) {
        return closestCenter({
          ...args,
          droppableContainers: filtered.filter(
            (container) => container.data.current?.type === "card",
          ),
        });
      }

      // 布局变化不等于新的指针意图。包括组间缝隙在内的所有命中都遵守锁定，
      // 避免刚建好的组在鼠标静止时被动画中的矩形重新判成移出分组。
      const lastPointer = lastPointerRef.current;
      if (
        intentLockedRef.current &&
        pointer &&
        lastPointer &&
        Math.hypot(pointer.x - lastPointer.x, pointer.y - lastPointer.y) <=
          POINTER_MOVE_RESET_PX
      ) {
        const target = lastOverIdRef.current ?? activeIdRef.current;
        return target ? [{ id: target }] : [];
      }

      const pointerIntersections = pointerWithin({
        ...args,
        droppableContainers: filtered,
      });

      // 分组间缝隙：pointerWithin 无命中且指针落在组与组之间的留白时，
      // 必须优先于 rectIntersection 兜底（后者会把邻近组误判为落点），
      // 视作未分组区落点——把卡片从分组拖到缝隙即可移出分组。
      if (pointerIntersections.length === 0) {
        const activeId = activeIdRef.current;
        if (pointer && originPrimary && activeId) {
          const groupsByTop = args.droppableContainers
            .filter((container) => container.data.current?.type === "group")
            .map((container) => ({
              id: String(container.id),
              rect: container.rect.current,
            }))
            .filter(
              (
                entry,
              ): entry is {
                id: string;
                rect: NonNullable<typeof entry.rect>;
              } => entry.rect != null,
            )
            .sort((a, b) => a.rect.top - b.rect.top);
          for (let i = 0; i < groupsByTop.length - 1; i += 1) {
            const upper = groupsByTop[i].rect;
            const lower = groupsByTop[i + 1].rect;
            const left = Math.min(upper.left, lower.left);
            const right = Math.max(upper.right, lower.right);
            if (
              pointer.x >= left &&
              pointer.x <= right &&
              pointer.y > upper.bottom &&
              pointer.y < lower.top
            ) {
              // 缝隙 = 纯预览落点：不移动真卡，只在上/下两组之间插占位；
              // 松手后才归入「未分组」头部（见 handleDragEnd）。
              effects.push(disarmIntent);
              effects.push(() => showGapPreview(groupsByTop[i + 1].id));
              lastOverIdRef.current = UNGROUPED_ID;
              return [{ id: UNGROUPED_ID }];
            }
          }
        }
      }

      // 离开缝隙进入正常 droppable：撤掉缝隙占位
      if (pointerIntersections.length > 0) effects.push(clearGapPreview);

      const intersections = pointer
        ? pointerIntersections
        : rectIntersection({ ...args, droppableContainers: filtered });
      if (intersections.length === 0) {
        effects.push(disarmIntent, clearGapPreview);
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
      if (overId === UNGROUPED_ID) {
        // 底部接收区明确表示追加，不再收敛到最近卡片中心。
        anchorRef.current = {
          containerId: overId,
          anchorId: null,
          anchorRect: null,
        };
        lastOverIdRef.current = overId;
        effects.push(() => {
          if (activeIdRef.current)
            updateIntentFromOver(overId, "ungrouped", activeIdRef.current);
        });
        return [{ id: overId }];
      }
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
            effects.push(() => {
              if (activeIdRef.current)
                updateIntentFromOver(overId, overType, activeIdRef.current);
            });
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
          effects.push(() => {
            if (activeIdRef.current)
              updateIntentFromOver(overId, overType, activeIdRef.current);
          });
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
        effects.push(() => {
          if (activeIdRef.current)
            updateIntentFromOver(overId, overType, activeIdRef.current);
        });
      }
      const cards = intersections.filter(
        (collision) => !containerIdsRef.current.has(String(collision.id)),
      );
      return [...cards, ...intersections.filter((c) => !cards.includes(c))];
    },
    [clearGapPreview, disarmIntent, showGapPreview, updateIntentFromOver],
  );

  const completeCurrentDrop = useCallback(
    () => finishDropAnimation(dragSequence),
    [finishDropAnimation, dragSequence],
  );

  return {
    sensors,
    collisionDetection,
    handlers: {
      onDragStart: handleDragStart,
      onDragMove: applyHoverEffects,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
      onDragCancel: handleDragCancel,
    },
    containers,
    containerOf,
    activeDrag: dragState,
    mergeTargetId,
    previewGroup,
    gapPreview,
    settlingId,
    finishDropAnimation: completeCurrentDrop,
    commitHeldLayout,
  };
}
