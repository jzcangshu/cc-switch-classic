import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  AutoScrollActivator,
  getScrollableAncestors,
  useDndContext,
  type AutoScrollOptions,
  type Collision,
  type CollisionDetection,
} from "@dnd-kit/core";

// ─── 手感参数（全部集中此处，浏览器调优轮在此微调）─────────────────────

/**
 * 触发带：滚动容器顶/底边缘各留这么窄的一条，指针压进去才开始滚动。
 * dnd-kit 默认是容器高度的 20%（桌面窗口下约 170px，正常挪位稍靠边就误触发）；
 * 56px 约半张卡片高，必须刻意顶到边缘才会滚动，同时给线性加速留出坡道。
 */
export const AUTO_SCROLL_ZONE_PX = 56;
/**
 * 带内满压（指针贴住容器边缘）时每一拍滚动的距离。官方默认 10px/5ms ≈
 * 2000px/s，扫列表时卡片糊成一片；5px/5ms ≈ 1000px/s ≈ 每秒流过 10 张卡，
 * 既能快速跨越长列表又能数清卡片，贴近 react-beautiful-dnd 调教过的量级。
 */
export const AUTO_SCROLL_ACCELERATION = 5;
/** 滚动节拍（沿用 dnd-kit 官方默认：带内速度随按压深度线性上升） */
export const AUTO_SCROLL_TICK_MS = 5;
/** 触发带占容器高度的比例上限：容器过矮时不让窄带吃掉半个可视区 */
export const AUTO_SCROLL_ZONE_MAX_RATIO = 0.2;
/**
 * 指针移动超过该距离视为「正在定位」：立即解除滚动冻结。
 * 与 useGroupDnd 的 POINTER_MOVE_RESET_PX 同一语义（真实移动判定），
 * 不能从那边 import——本模块被 useGroupDnd 引用，会成环。
 */
export const SCROLL_FREEZE_RELEASE_PX = 10;
/** 滚动事件安静多久后视为安定：安定后用重测的落点矩形重算一次碰撞 */
export const SCROLL_SETTLE_MS = 160;

/** 把固定像素触发带换算成 dnd-kit 的比例阈值（threshold 相对容器高度） */
export function resolveZoneRatio(containerHeight: number): number {
  if (!Number.isFinite(containerHeight) || containerHeight <= 0) {
    return AUTO_SCROLL_ZONE_MAX_RATIO;
  }
  return Math.min(
    AUTO_SCROLL_ZONE_PX / containerHeight,
    AUTO_SCROLL_ZONE_MAX_RATIO,
  );
}

export interface DragAutoScrollControls {
  /** DndContext 的 autoScroll prop */
  autoScroll: AutoScrollOptions | undefined;
  /**
   * 挂到卡片列表共同祖先上的 ref 回调：挂载即量出 dnd-kit 会滚的滚动容器、
   * 换算触发带（state 只在此处和窗口 resize 时更新一次）。
   */
  attachScrollRoot: (element: HTMLElement | null) => void;
  /** 传给 DragScrollCoordinator 的 onScroll：每次滚动事件触发 */
  notifyDragScroll: () => void;
  /**
   * 碰撞检测包装：滚动冻结窗口内返回上一次结果（over 与一切视觉都不动），
   * 解冻后用重测过的矩形重算。渲染期调用一次并把它挂到 DndContext 上。
   */
  freezeCollision: (base: CollisionDetection) => CollisionDetection;
  /** 当前是否处于滚动冻结窗口（armIntent 等悬停效果据此静默） */
  isScrollFrozen: () => boolean;
  /** 每次滚动事件自增（消费方据此撤销已武装的悬停意图） */
  scrollGeneration: number;
  /** 滚动安定后自增：这次渲染里碰撞已用新矩形重算，可做收尾 */
  settleGeneration: number;
}

/**
 * 拖拽自动滚动的调和层。
 *
 * 背景：v2 为了保住 iOS 式「静止悬停才互动」判定把 dnd-kit 的 AutoScroller
 * 整个关掉了——滚动会移动指针下的内容，悬停波段 / dwell 计时会被内容流动
 * 打乱，挤开动画也会和滚动叠在一起。本模块重新启用官方 AutoScroller（沿用
 * 它调教好的手感：指针激活、带内深度线性加速、滚动方向意图防打架），并把
 * 三个矛盾点逐一定律化：
 *
 * 1. 触发带收到顶/底各 56px 的固定窄带，其他区域永不触发；
 * 2. 滚动事件期间整体冻结：碰撞检测停在滚动前的结果、悬停意图静默并撤销
 *    已武装的 dwell——滚动就是纯粹的视口运动，挤开/建组/落位都不参与；
 *    同时每个滚动事件重测一次落点矩形（dnd-kit 拖拽中不会因滚动自动重测，
 *    不补这一步，滚动后的第一下悬停会按滚动前的旧矩形算错位置）；
 * 3. 解冻只有两条路，都要求「用户表达了新意图」：指针真实移动超过
 *    SCROLL_FREEZE_RELEASE_PX（正在定位），或滚动安静 SCROLL_SETTLE_MS
 *    （压在列表尽头没动）。安定重算让「滚动到底直接松手」也能按指针位置
 *    落位，而不是弹回原点。
 */
export function useDragAutoScroll(): DragAutoScrollControls {
  const [zoneRatio, setZoneRatio] = useState<number | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  const measure = useCallback((element: HTMLElement | null) => {
    if (!element) {
      setZoneRatio(null);
      return;
    }
    // getScrollableAncestors 返回 innermost-first，[0] 就是卡片所在的滚动容器
    const container = getScrollableAncestors(element)[0];
    const height = container?.getBoundingClientRect().height ?? 0;
    setZoneRatio(resolveZoneRatio(height));
  }, []);

  // ref 回调里同步测量：滚动容器在 ref 触发前已插入文档，几何是准的；
  // 挂载只因此多一次重渲染，比「挂载 → effect 再测」少一拍
  const attachScrollRoot = useCallback(
    (element: HTMLElement | null) => {
      rootRef.current = element;
      measure(element);
    },
    [measure],
  );

  // 窗口尺寸变化重算触发带：比例随容器高度走，窄带保持固定像素
  useEffect(() => {
    const remeasure = () => measure(rootRef.current);
    window.addEventListener("resize", remeasure);
    return () => window.removeEventListener("resize", remeasure);
  }, [measure]);

  const autoScroll = useMemo<AutoScrollOptions | undefined>(() => {
    if (zoneRatio == null) return undefined;
    return {
      // x 留官方默认：主滚动容器 overflow-x-hidden，横向命中到不了速度公式
      threshold: { x: 0.2, y: zoneRatio },
      acceleration: AUTO_SCROLL_ACCELERATION,
      interval: AUTO_SCROLL_TICK_MS,
      activator: AutoScrollActivator.Pointer,
    };
  }, [zoneRatio]);

  // ── 冻结状态机：滚动事件 → 冻结；指针真实移动 / 滚动安定 → 解冻 ──
  const frozenRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releasePointerRef = useRef<{ x: number; y: number } | null>(null);
  const [scrollGeneration, bumpScrollGeneration] = useReducer(
    (count: number) => count + 1,
    0,
  );
  const [settleGeneration, bumpSettleGeneration] = useReducer(
    (count: number) => count + 1,
    0,
  );

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const releaseFreeze = useCallback(() => {
    if (!frozenRef.current && settleTimerRef.current === null) return;
    frozenRef.current = false;
    clearSettleTimer();
  }, [clearSettleTimer]);

  const notifyDragScroll = useCallback(() => {
    frozenRef.current = true;
    bumpScrollGeneration();
    clearSettleTimer();
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      frozenRef.current = false;
      // 安定：落点矩形已随滚动重测到位，强制重跑一次碰撞（指针没动，
      // 不会再有传感器事件），让「压在尽头不动」也能按当前位置武装/落位
      bumpSettleGeneration();
    }, SCROLL_SETTLE_MS);
  }, [clearSettleTimer]);

  const isScrollFrozen = useCallback(() => frozenRef.current, []);

  // 卸载清掉安定定时器：残留回调不得再 bump 已卸载组件的状态
  useEffect(() => clearSettleTimer, [clearSettleTimer]);

  const baseRef = useRef<CollisionDetection | null>(null);
  const lastResultRef = useRef<Collision[] | null>(null);
  const frozenDetection = useCallback<CollisionDetection>(
    (args) => {
      const pointer = args.pointerCoordinates;
      if (pointer) {
        const last = releasePointerRef.current;
        if (
          last &&
          Math.hypot(pointer.x - last.x, pointer.y - last.y) >
            SCROLL_FREEZE_RELEASE_PX
        ) {
          releaseFreeze();
        }
        releasePointerRef.current = pointer;
      }
      if (frozenRef.current) {
        return lastResultRef.current ?? [];
      }
      const result = baseRef.current?.(args) ?? [];
      lastResultRef.current = result;
      return result;
    },
    [releaseFreeze],
  );

  /** 渲染期调用：登记最新的碰撞检测，返回稳定的冻结包装 */
  const freezeCollision = useCallback(
    (base: CollisionDetection) => {
      baseRef.current = base;
      return frozenDetection;
    },
    [frozenDetection],
  );

  return {
    autoScroll,
    attachScrollRoot,
    notifyDragScroll,
    freezeCollision,
    isScrollFrozen,
    scrollGeneration,
    settleGeneration,
  };
}

interface DragScrollCoordinatorProps {
  onScroll: () => void;
}

/**
 * DndContext 子组件：拖拽期间监听 dnd-kit 选定的滚动祖先（与 AutoScroller
 * 滚的容器完全一致），每个滚动事件重测一次落点矩形并向上通报。
 * 拖拽结束自动摘掉监听。
 */
export function DragScrollCoordinator({
  onScroll,
}: DragScrollCoordinatorProps) {
  const { active, scrollableAncestors, measureDroppableContainers } =
    useDndContext();
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;

  useEffect(() => {
    if (!active || scrollableAncestors.length === 0) return;
    const handleScroll = () => {
      // dnd-kit 拖拽中不会因滚动重测 droppable 矩形（只有 items 变化 /
      // 注册变化才重测），不主动补测的话滚动后的落点判定全按旧矩形算
      measureDroppableContainers([]);
      onScrollRef.current();
    };
    for (const element of scrollableAncestors) {
      element.addEventListener("scroll", handleScroll, { passive: true });
    }
    return () => {
      for (const element of scrollableAncestors) {
        element.removeEventListener("scroll", handleScroll);
      }
    };
  }, [active, scrollableAncestors, measureDroppableContainers]);

  return null;
}
