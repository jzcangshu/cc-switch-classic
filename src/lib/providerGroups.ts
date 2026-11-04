import type {
  Provider,
  ProviderGroupDefinition,
  ProviderGroupsMap,
} from "@/types";

/**
 * 主页供应商卡片分组的纯逻辑层：布局解析、归属变更、提交计算。
 * 只做展示归组，不参与内核的切换 / 队列逻辑；所有函数返回新数组，不原地修改。
 */

/** 未分组容器的虚拟 id（不出现在 settings 里，仅渲染与拖拽判定用） */
export const UNGROUPED_ID = "__ungrouped__";

/** 卡片 ⋯ 菜单兜底的「移动到分组」子菜单（仅有分组时渲染） */
export interface ProviderGroupMenuOption {
  key: string;
  label: string;
  checked?: boolean;
  onSelect: () => void;
}

export interface ProviderGroupMenu {
  options: ProviderGroupMenuOption[];
}

/** 拖到另一张未分组卡片上停顿多久合成新分组（对齐 iOS：停一小下） */
export const DWELL_CREATE_GROUP_MS = 400;

/** 拖到折叠分组上停顿多久自动展开 */
export const DWELL_EXPAND_GROUP_MS = 350;

export function getGroupsForApp(
  map: ProviderGroupsMap | null | undefined,
  appId: string,
): ProviderGroupDefinition[] {
  return map?.[appId] ?? [];
}

export function isGroupingActive(
  appGroups: ProviderGroupDefinition[] | undefined,
): boolean {
  return (appGroups?.length ?? 0) > 0;
}

export interface GroupContainerLayout {
  /** 分组 id，或 UNGROUPED_ID */
  id: string;
  /** 未分组容器时为 null（名字由 UI 按 i18n 渲染） */
  group: ProviderGroupDefinition | null;
  /** 有效成员（过滤掉不存在的供应商后），顺序即展示顺序 */
  providerIds: string[];
}

export interface GroupedLayout {
  containers: GroupContainerLayout[];
  /** providerId -> 容器 id */
  containerOf: Record<string, string>;
}

/**
 * 把主分区卡片按分组切开展示结构。
 * groups 里指向不存在供应商的 id 被忽略（app_order 同款容错）；
 * 未分组容器固定排最后；分组定义保留（哪怕暂时一个成员都没有，
 * 比如成员被移出配置后续可能加回来——只有用户拖拽产生的空组才在提交时清理）。
 */
export function resolveGroupedLayout(
  groups: ProviderGroupDefinition[],
  items: Provider[],
): GroupedLayout {
  const known = new Set(items.map((p) => p.id));
  const containers: GroupContainerLayout[] = groups.map((group) => ({
    id: group.id,
    group,
    providerIds: group.providerIds.filter((id) => known.has(id)),
  }));
  const grouped = new Set(containers.flatMap((c) => c.providerIds));
  containers.push({
    id: UNGROUPED_ID,
    group: null,
    providerIds: items.map((p) => p.id).filter((id) => !grouped.has(id)),
  });
  const containerOf: Record<string, string> = {};
  for (const container of containers) {
    for (const id of container.providerIds) {
      containerOf[id] = container.id;
    }
  }
  return { containers, containerOf };
}

/** 拖拽与 ⋯ 菜单共用的容器布局内存态（拖拽中只改它，松手才提交） */
export type PendingLayout = Record<string, string[]>;

export function layoutToPending(layout: GroupedLayout): PendingLayout {
  const pending: PendingLayout = {};
  for (const container of layout.containers) {
    pending[container.id] = [...container.providerIds];
  }
  return pending;
}

/**
 * 把 provider 移到目标容器：跨容器进入时落在 beforeProviderId 之前（null = 追加末尾）；
 * 同容器内按 dnd-kit arrayMove 的方向语义——向下拖落到 over 之后、向上拖落到之前，
 * 保证松手后的落点和拖拽中的视觉位移一致。
 * 目标容器不存在时原样返回。
 */
export function moveProviderInPending(
  pending: PendingLayout,
  providerId: string,
  targetContainerId: string,
  beforeProviderId?: string | null,
): PendingLayout {
  if (!pending[targetContainerId]) return pending;
  const next: PendingLayout = {};
  for (const [key, ids] of Object.entries(pending)) {
    next[key] = ids.filter((id) => id !== providerId);
  }
  const ids = pending[targetContainerId];
  const filtered = next[targetContainerId];
  const activeIndex = ids.indexOf(providerId);
  const overIndex = beforeProviderId ? ids.indexOf(beforeProviderId) : -1;
  let index: number;
  if (overIndex === -1) {
    index = filtered.length;
  } else if (activeIndex !== -1 && activeIndex < overIndex) {
    // 向下拖：越过 over（arrayMove 同款——落到它后面）
    index = filtered.indexOf(beforeProviderId!) + 1;
  } else {
    // 向上拖 / 从别的容器进入：落到 over 之前
    index = filtered.indexOf(beforeProviderId!);
  }
  filtered.splice(index, 0, providerId);
  return next;
}

/** 容器内重排与跨容器移动共用 moveProviderInPending（先摘除再插入，天然覆盖同容器情形） */

/**
 * 悬停合成新分组：把两张卡组成一个新组，追加到分组列表末尾
 * （视觉上最贴近手势发生的位置——分组区排在未分组之前）。
 */
export function createGroupWithProviders(
  groups: ProviderGroupDefinition[],
  providerIds: [string, string],
  name: string,
): ProviderGroupDefinition[] {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `grp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return [...groups, { id, name, providerIds: [...providerIds] }];
}

export function renameGroup(
  groups: ProviderGroupDefinition[],
  groupId: string,
  name: string,
): ProviderGroupDefinition[] {
  return groups.map((group) =>
    group.id === groupId ? { ...group, name } : group,
  );
}

/** 分组头拖动排序 */
export function reorderGroups(
  groups: ProviderGroupDefinition[],
  activeGroupId: string,
  overGroupId: string,
): ProviderGroupDefinition[] {
  const from = groups.findIndex((g) => g.id === activeGroupId);
  const to = groups.findIndex((g) => g.id === overGroupId);
  if (from === -1 || to === -1 || from === to) return groups;
  const next = [...groups];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * 清理拖拽后没有任何有效成员的分组（组空自毁，对齐 iOS）。
 * 只在用户驱动的提交（拖拽 / 菜单移动）后调用；供应商被删除不触发。
 */
export function pruneEmptyGroups(
  groups: ProviderGroupDefinition[],
  validProviderIds: Set<string>,
): ProviderGroupDefinition[] {
  return groups.filter((group) =>
    group.providerIds.some((id) => validProviderIds.has(id)),
  );
}

/**
 * 从拖拽内存态布局还原分组定义（成员按 pendingLayout 顺序）。
 * pendingLayout 里缺失的容器保持原定义（不应发生，防御性保留）。
 */
export function pendingToGroups(
  groups: ProviderGroupDefinition[],
  pending: PendingLayout,
  validProviderIds: Set<string>,
): ProviderGroupDefinition[] {
  return groups
    .filter((group) => pending[group.id])
    .map((group) => ({ ...group, providerIds: pending[group.id] }))
    .filter((group) =>
      group.providerIds.some((id) => validProviderIds.has(id)),
    );
}

/**
 * 分组拖拽提交后的全局 sortIndex 重写：
 * 新的全局顺序 = 分组容器按序拼接（组序 × 组内序）+ 非主分区供应商（队列 /
 * 可添加等，保持现有相对顺序接在后面）。
 * 与现有 handleDragEnd 的全量重写同语义——代理应用的 failover 队列顺序
 * （= sort_index 顺序）随之由分组视图的排列决定，与今日拖拽行为一致。
 */
export function buildSortIndexUpdates(
  containers: GroupContainerLayout[],
  primaryIds: Set<string>,
  flatSorted: Provider[],
): { id: string; sortIndex: number }[] {
  const primaryOrder: string[] = [];
  for (const container of containers) {
    for (const id of container.providerIds) {
      if (primaryIds.has(id) && !primaryOrder.includes(id)) {
        primaryOrder.push(id);
      }
    }
  }
  const rest = flatSorted
    .map((p) => p.id)
    .filter((id) => !primaryIds.has(id) || !primaryOrder.includes(id));
  return [...primaryOrder, ...rest].map((id, index) => ({
    id,
    sortIndex: index,
  }));
}

// ─── iOS 手势扩展（v2 拖拽模型）：悬停波段 / 插入计划 / 合组 / 消散 ────────

/** 指针落在锚点卡片上的纵向波段：上下边缘=插入挪位，中间=建组（iOS 语义移植） */
export type HoverBand = "before" | "after" | "middle";

/**
 * 由指针 Y 与锚点卡片矩形算波段：上/下各占卡片高度 edgeRatio 的边缘带返回
 * before / after，中间带返回 middle。指针缺失（键盘拖拽）或矩形缺失返回 null，
 * 调用方降级为纯插入、不触发建组。
 */
export function resolveHoverBand(
  pointerY: number | null,
  anchorRect: { top: number; height: number } | null,
  edgeRatio = 0.25,
): HoverBand | null {
  if (pointerY == null || !anchorRect || anchorRect.height <= 0) return null;
  const progress = (pointerY - anchorRect.top) / anchorRect.height;
  if (progress < edgeRatio) return "before";
  if (progress > 1 - edgeRatio) return "after";
  return "middle";
}

/** 卡片当前所在容器的快速定位 */
export function findCardContainer(
  pending: PendingLayout,
  providerId: string,
): string | null {
  for (const [containerId, ids] of Object.entries(pending)) {
    if (ids.includes(providerId)) return containerId;
  }
  return null;
}

/**
 * 悬停到点后的插入计划：把 activeId 移入 containerId 的 anchorId 前/后
 * （anchorId 为 null 时追加末尾）。目标位置与当前位置完全一致时返回
 * changed=false 与原引用，避免无谓渲染。
 */
export function planInsert(
  pending: PendingLayout,
  activeId: string,
  containerId: string,
  anchorId: string | null,
  position: "before" | "after",
): { next: PendingLayout; changed: boolean } {
  const target = pending[containerId];
  if (!target) return { next: pending, changed: false };
  const originContainer = findCardContainer(pending, activeId);
  if (!originContainer) return { next: pending, changed: false };

  // 目标容器内（摘除 active 后）的插入下标
  const without = target.filter((id) => id !== activeId);
  const anchorIndex = anchorId ? without.indexOf(anchorId) : -1;
  const index =
    !anchorId || anchorIndex === -1
      ? without.length
      : position === "before"
        ? anchorIndex
        : anchorIndex + 1;

  const next: PendingLayout = {};
  for (const [key, ids] of Object.entries(pending)) {
    next[key] = ids.filter((id) => id !== activeId);
  }
  const arr = [...next[containerId]];
  arr.splice(index, 0, activeId);
  next[containerId] = arr;

  const changed =
    originContainer !== containerId ||
    arr.join("\u0000") !== pending[containerId].join("\u0000");
  return changed ? { next, changed } : { next: pending, changed: false };
}

/**
 * 悬停建组：A 压到未分组卡片 B 上停顿到点后，新建一个分组（追加到分组列表
 * 末尾，A 在前），两卡同时从各容器摘除。前置条件不满足（任一卡不在未分组、
 * 是同一张卡）返回 null，调用方静默放弃。
 */
export function mergeIntoNewGroup(
  groups: ProviderGroupDefinition[],
  pending: PendingLayout,
  activeId: string,
  anchorId: string,
  name: string,
): {
  groups: ProviderGroupDefinition[];
  pending: PendingLayout;
  newGroupId: string;
} | null {
  const ungrouped = pending[UNGROUPED_ID];
  if (!ungrouped) return null;
  if (activeId === anchorId) return null;
  if (!ungrouped.includes(activeId) || !ungrouped.includes(anchorId)) {
    return null;
  }
  const newGroupId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `grp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const nextPending: PendingLayout = {};
  for (const [key, ids] of Object.entries(pending)) {
    nextPending[key] = ids.filter((id) => id !== activeId && id !== anchorId);
  }
  if (!nextPending[UNGROUPED_ID]) nextPending[UNGROUPED_ID] = [];
  nextPending[newGroupId] = [activeId, anchorId];
  return {
    groups: [...groups, { id: newGroupId, name, providerIds: [activeId, anchorId] }],
    pending: nextPending,
    newGroupId,
  };
}

/**
 * 消散本次拖拽中新建、但拖动方最终不在其中的分组：组成员按原相对顺序退回
 * 未分组头部（分组区在未分组上方，退回头部对应用户看到的位置）。
 * 对应 iOS「拖离 → 预览框消散」。组不在 pending 中时静默跳过。
 */
export function dissolveDragCreatedGroups(
  groups: ProviderGroupDefinition[],
  pending: PendingLayout,
  createdGroupIds: string[],
): { groups: ProviderGroupDefinition[]; pending: PendingLayout } {
  let nextGroups = groups;
  let nextPending = pending;
  for (const groupId of createdGroupIds) {
    const members = nextPending[groupId];
    if (!members) continue;
    const rest: PendingLayout = { ...nextPending };
    delete rest[groupId];
    rest[UNGROUPED_ID] = [...members, ...(nextPending[UNGROUPED_ID] ?? [])];
    nextPending = rest;
    nextGroups = nextGroups.filter((group) => group.id !== groupId);
  }
  return { groups: nextGroups, pending: nextPending };
}

/**
 * 渲染派生：拖拽内存态（分组定义快照 + pending 布局）→ 容器展示结构。
 * 与 resolveGroupedLayout 同构，但成员顺序完全以 pending 为准（拖拽中数组
 * 即真相），不存在的供应商照常过滤。
 */
export function pendingLayoutToContainers(
  groups: ProviderGroupDefinition[],
  pending: PendingLayout,
  items: Provider[],
): GroupContainerLayout[] {
  const known = new Set(items.map((p) => p.id));
  const containers: GroupContainerLayout[] = groups.map((group) => ({
    id: group.id,
    group,
    providerIds: (pending[group.id] ?? []).filter((id) => known.has(id)),
  }));
  containers.push({
    id: UNGROUPED_ID,
    group: null,
    providerIds: (pending[UNGROUPED_ID] ?? []).filter((id) => known.has(id)),
  });
  return containers;
}
