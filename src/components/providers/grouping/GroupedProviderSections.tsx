import { useCallback, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  useDroppable,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Provider, ProviderGroupDefinition } from "@/types";
import type { ProvidersQueryData } from "@/lib/query/queries";
import type { AppId } from "@/lib/api";
import { providersApi } from "@/lib/api/providers";
import { isProxyAppId } from "@/config/appConfig";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  buildSortIndexUpdates,
  moveProviderInPending,
  pendingLayoutToContainers,
  pendingToGroups,
  renameGroup,
  resolveGroupedLayout,
  layoutToPending,
  UNGROUPED_ID,
  type PendingLayout,
  type ProviderGroupMenu,
} from "@/lib/providerGroups";
import type { ProviderGroupsApi } from "@/hooks/useProviderGroups";
import { HelpTip } from "@/components/ui/help-tip";
import type {
  CardPresentation,
  ProviderSection,
} from "@/components/providers/presentation";
import {
  ProviderGroupContainer,
  type GroupMiniIcon,
} from "./ProviderGroupContainer";
import { GroupDragGhost } from "./GroupDragGhost";
import { DROP_ANIMATION, GROUP_ENTER_SPRING, useGroupDnd } from "./useGroupDnd";

/** 拖影只做纵向跟随（与卡片拖拽的纵向语义一致） */
const overlayModifiers: Modifier[] = [({ transform }) => ({ ...transform, x: 0 })];

interface GroupedProviderSectionsProps {
  appId: AppId;
  /** builders 原样输出的全部分区 */
  sections: ProviderSection[];
  /** 主分区 key（切换式 "all" / 共存式 "added"），分组只替换这一个分区 */
  primaryKey: string;
  /** 全局排序（提交 sortIndex 重写用） */
  sortedProviders: Provider[];
  /** 卡片渲染由 ProviderList 提供（含 isCurrent / isInConfig / 测试等上下文） */
  renderCard: (
    provider: Provider,
    presentation: CardPresentation,
    groupMenu?: ProviderGroupMenu,
    flags?: { isMergeTarget?: boolean },
  ) => ReactNode;
  /** 拖影用非 sortable 卡片渲染（ProviderCard 本体 + 抬起视觉） */
  renderPlainCard: (
    provider: Provider,
    presentation: CardPresentation,
  ) => ReactNode;
  /** 分组视图状态（hook 在 ProviderList 提升为单实例） */
  providerGroups: ProviderGroupsApi;
  /** 非主分区卡片的拖拽沿用平铺重排逻辑 */
  onFlatDragEnd: (event: DragEndEvent) => void;
}

/** 与 ProviderList 同款的分区标题（其余分区在分组视图下的渲染复用） */
function SectionTitle({ section }: { section: ProviderSection }) {
  if (!section.title) return null;
  return (
    <div className="flex items-center gap-1 text-caption font-semibold text-fg-2">
      <h2 className="m-0 text-caption font-semibold">{section.title}</h2>
      {section.help && (
        <HelpTip title={section.help.title}>{section.help.body}</HelpTip>
      )}
      {section.note && (
        <span className="ms-1 font-normal text-fg-3">{section.note}</span>
      )}
    </div>
  );
}

/**
 * 认领板：合并意图武装时从锚点卡四周扩展生出的浅色边缘（iOS 建文件夹预告）。
 * 渲染在卡片之下，卡片本体同时微缩，边缘从四周均匀露出。
 */
function MergePlate() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute -inset-2 z-0 rounded-xl border border-primary/50 bg-primary/[0.07]"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
    />
  );
}

/**
 * 分组视图：把主分区的卡片切成「分组容器 + 未分组」两个层级，其余分区原样跟在后面。
 * 拖拽模型 = dnd-kit 官方多容器模式：拖拽中 per-container items 即时更新（悬停
 * 门槛后），DragOverlay 拖影跟随，松手一次性提交（分组定义 + sortIndex 重写）。
 * 组容器的挂载（建组）/ 卸载（消散）统一走 AnimatePresence：入场 spring、
 * 离场高度收拢幽灵，杜绝任何瞬时出现 / 消失。
 */
export function GroupedProviderSections({
  appId,
  sections,
  primaryKey,
  sortedProviders,
  renderCard,
  renderPlainCard,
  providerGroups,
  onFlatDragEnd,
}: GroupedProviderSectionsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { groups, saveAppGroups, isGroupCollapsed, setGroupCollapsed } =
    providerGroups;

  const primarySection = sections.find((section) => section.key === primaryKey);
  const otherSections = useMemo(
    () => sections.filter((section) => section.key !== primaryKey),
    [sections, primaryKey],
  );
  const primaryItems = primarySection?.items ?? [];
  const primaryProviders = useMemo(
    () => primaryItems.map((item) => item.provider),
    [primaryItems],
  );

  const presentationById = useMemo(() => {
    const map = new Map<string, CardPresentation>();
    for (const item of primaryItems) {
      map.set(item.provider.id, item.presentation);
    }
    return map;
  }, [primaryItems]);
  /** 全部分区（含可添加 / 队列等）的条目：拖影渲染需要非主分区卡的数据 */
  const allItemsById = useMemo(() => {
    const map = new Map<
      string,
      { provider: Provider; presentation: CardPresentation }
    >();
    for (const section of sections) {
      for (const item of section.items) {
        map.set(item.provider.id, item);
      }
    }
    return map;
  }, [sections]);
  const providerById = useMemo(() => {
    const map = new Map<string, Provider>();
    for (const provider of sortedProviders) map.set(provider.id, provider);
    return map;
  }, [sortedProviders]);

  // ─── 提交漏斗：分组定义 + sortIndex 一次落盘 ──────────────────────────
  const commitSortIndexes = useCallback(
    async (updates: { id: string; sortIndex: number }[]) => {
      try {
        await providersApi.updateSortOrder(updates, appId);
        await queryClient.invalidateQueries({
          queryKey: ["providers", appId],
        });
        if (isProxyAppId(appId)) {
          await queryClient.invalidateQueries({
            queryKey: ["failoverQueue", appId],
          });
        }
        try {
          await providersApi.updateTrayMenu();
        } catch (trayError) {
          console.error(
            "Failed to update tray menu after group change",
            trayError,
          );
        }
      } catch (error) {
        console.error("Failed to update provider sort order", error);
        toast.error(
          t("provider.sortUpdateFailed", { defaultValue: "排序更新失败" }),
        );
      }
    },
    [appId, queryClient, t],
  );

  const commitLayout = useCallback(
    (pending: PendingLayout, draftGroups: ProviderGroupDefinition[]) => {
      const validIds = new Set(primaryProviders.map((p) => p.id));
      const nextGroups = pendingToGroups(draftGroups, pending, validIds);
      saveAppGroups(nextGroups);
      // 布局以拖拽内存态为准：未分组的新顺序只存在于 pending，
      // resolveGroupedLayout 会用 props 的旧顺序把它冲掉（松手还原的根因）
      const layout = pendingLayoutToContainers(nextGroups, pending, primaryProviders);
      const updates = buildSortIndexUpdates(layout, validIds, sortedProviders);
      // 乐观写入 providers 缓存的 sortIndex：落盘 + refetch 完成前不回闪旧顺序
      queryClient.setQueryData<ProvidersQueryData>(
        ["providers", appId],
        (old) => {
          if (!old) return old;
          const indexById = new Map(updates.map((u) => [u.id, u.sortIndex]));
          const providers = Object.fromEntries(
            Object.entries(old.providers).map(([id, p]) => [
              id,
              indexById.has(id) ? { ...p, sortIndex: indexById.get(id) } : p,
            ]),
          );
          return { ...old, providers };
        },
      );
      void commitSortIndexes(updates);
    },
    [primaryProviders, saveAppGroups, sortedProviders, commitSortIndexes, queryClient, appId],
  );

  const {
    sensors,
    collisionDetection,
    handlers,
    containers,
    containerOf,
    activeDrag,
    mergeTargetId,
    hoverContainerId,
    newbornGroupIds,
  } = useGroupDnd({
    primaryProviders,
    groups,
    isGroupCollapsed,
    expandGroup: (groupId) => setGroupCollapsed(groupId, false),
    commitLayout,
    onFlatDragEnd,
  });

  // ─── ⋯ 菜单兜底：移动到分组（仅有分组时出现）─────────────────────────
  const moveToContainer = useCallback(
    (providerId: string, targetContainerId: string) => {
      const layout = resolveGroupedLayout(groups, primaryProviders);
      const pendingNext = moveProviderInPending(
        layoutToPending(layout),
        providerId,
        targetContainerId,
        null,
      );
      commitLayout(
        pendingNext,
        layout.containers
          .map((container) => container.group)
          .filter((group): group is ProviderGroupDefinition => group !== null),
      );
    },
    [groups, primaryProviders, commitLayout],
  );

  const buildGroupMenu = useCallback(
    (provider: Provider): ProviderGroupMenu | undefined => {
      if (groups.length === 0) return undefined;
      const current = containerOf[provider.id];
      const options = containers
        .filter((container) => container.group !== null)
        .map((container) => ({
          key: container.id,
          label: container.group!.name,
          checked: container.id === current,
          onSelect: () => moveToContainer(provider.id, container.id),
        }));
      if (current && current !== UNGROUPED_ID) {
        options.push({
          key: UNGROUPED_ID,
          label: t("providerGroups.ungrouped", { defaultValue: "未分组" }),
          checked: false,
          onSelect: () => moveToContainer(provider.id, UNGROUPED_ID),
        });
      }
      return { options };
    },
    [groups, containers, containerOf, moveToContainer, t],
  );

  const buildMiniIcons = useCallback(
    (providerIds: string[]): GroupMiniIcon[] =>
      providerIds
        .slice(0, 4)
        .map((id) => providerById.get(id))
        .filter((provider): provider is Provider => Boolean(provider))
        .map(
          (provider) =>
            ({
              id: provider.id,
              name: provider.name,
              icon: provider.icon,
              iconColor: provider.iconColor,
            }) satisfies GroupMiniIcon,
        ),
    [providerById],
  );

  const renderFlatSection = (section: ProviderSection) => (
    <section key={section.key} className="space-y-3">
      {section.title && (
        <div className="pt-1">
          <SectionTitle section={section} />
        </div>
      )}
      {section.items.length === 0 && section.emptyText ? (
        <div className="rounded-panel border border-dashed border-border px-4 py-3 text-caption text-fg-3">
          {section.emptyText}
        </div>
      ) : (
        <SortableContext
          items={section.items.map((item) => item.provider.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {section.items.map((item) =>
              renderCard(item.provider, item.presentation),
            )}
          </div>
        </SortableContext>
      )}
    </section>
  );

  const groupContainers = useMemo(
    () => containers.filter((container) => container.group !== null),
    [containers],
  );
  const ungroupedIds = useMemo(
    () => containers.find((c) => c.id === UNGROUPED_ID)?.providerIds ?? [],
    [containers],
  );
  const isCardDragging = activeDrag?.activeType === "card";

  if (!primarySection) {
    // 主分区不存在（如路由视图故障转移开启时的 queue/rest）：整页按平铺渲染
    return <>{sections.map((section) => renderFlatSection(section))}</>;
  }

  const renderGroupedCard = (providerId: string) => {
    const presentation = presentationById.get(providerId);
    const provider = providerById.get(providerId);
    if (!presentation || !provider) return null;
    const isMergeTarget = mergeTargetId === providerId && isCardDragging;
    return (
      <div className="relative">
        <AnimatePresence>
          {isMergeTarget && <MergePlate key="merge-plate" />}
        </AnimatePresence>
        {renderCard(provider, presentation, buildGroupMenu(provider), {
          isMergeTarget,
        })}
      </div>
    );
  };

  // ─── 拖影内容（官方 DragOverlay 同构：主动本体不可见，可见体只有这里）───
  const overlayContent = (() => {
    if (!activeDrag) return null;
    const widthStyle =
      activeDrag.overlayWidth != null
        ? { width: activeDrag.overlayWidth }
        : undefined;
    if (activeDrag.activeType === "card") {
      const item = allItemsById.get(activeDrag.activeId);
      if (!item) return null;
      return <div style={widthStyle}>{renderPlainCard(item.provider, item.presentation)}</div>;
    }
    const container = containers.find((c) => c.id === activeDrag.activeId);
    if (!container?.group) return null;
    return (
      <GroupDragGhost
        appId={appId}
        group={container.group}
        miniIcons={buildMiniIcons(container.providerIds)}
      />
    );
  })();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handlers.onDragStart}
      onDragOver={handlers.onDragOver}
      onDragEnd={handlers.onDragEnd}
      onDragCancel={handlers.onDragCancel}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      // 关闭拖拽自动滚动：页面高度有限，滚动会移动指针下的内容、
      // 破坏 iOS 式「静止悬停才互动」的判定（移动端化行为与桌面场景不符）
      autoScroll={false}
    >
      {/* 外层：分组间排序（官方容器排序同构）。未分组容器不参与，固定最后 */}
      <SortableContext
        items={groupContainers.map((container) => container.id)}
        strategy={verticalListSortingStrategy}
      >
        <AnimatePresence initial={false}>
          {groupContainers.map((container) => (
            <motion.div
              key={container.id}
              layout
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, height: 0 }}
              transition={GROUP_ENTER_SPRING}
            >
              <ProviderGroupContainer
                appId={appId}
                group={container.group!}
                isDragOver={Boolean(
                  isCardDragging && hoverContainerId === container.id,
                )}
                isCollapsed={isGroupCollapsed(container.id)}
                isNewborn={newbornGroupIds.includes(container.id)}
                onToggleCollapse={() =>
                  setGroupCollapsed(
                    container.id,
                    !isGroupCollapsed(container.id),
                  )
                }
                onRename={(name) =>
                  saveAppGroups(renameGroup(groups, container.id, name))
                }
                miniIcons={buildMiniIcons(container.providerIds)}
              >
                <SortableContext
                  items={container.providerIds}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {container.providerIds.map((id) => (
                      <div key={id}>{renderGroupedCard(id)}</div>
                    ))}
                  </div>
                </SortableContext>
              </ProviderGroupContainer>
            </motion.div>
          ))}
        </AnimatePresence>
      </SortableContext>

      <UngroupedContainer
        showHeader={groups.length > 0}
        isEmptyDuringDrag={Boolean(
          isCardDragging && ungroupedIds.length === 0,
        )}
        isDragOver={Boolean(
          isCardDragging && hoverContainerId === UNGROUPED_ID,
        )}
      >
        <SortableContext items={ungroupedIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {ungroupedIds.map((id) => (
              <div key={id}>{renderGroupedCard(id)}</div>
            ))}
          </div>
        </SortableContext>
      </UngroupedContainer>

      {otherSections.map((section) => renderFlatSection(section))}

      {createPortal(
        <DragOverlay
          dropAnimation={DROP_ANIMATION}
          modifiers={overlayModifiers}
        >
          {overlayContent}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

/** 未分组区：无盒子保持现状观感；只有存在分组时才显示「未分组」标题，拖拽中始终可放置 */
function UngroupedContainer({
  showHeader,
  isEmptyDuringDrag,
  isDragOver,
  children,
}: {
  showHeader: boolean;
  isEmptyDuringDrag: boolean;
  isDragOver: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({
    id: UNGROUPED_ID,
    data: { type: "ungrouped" },
  });
  return (
    <section
      ref={setNodeRef}
      data-provider-group="ungrouped"
      className={cn(
        "space-y-3 rounded-2xl transition-all duration-150",
        isDragOver && "bg-primary/[0.06] ring-1 ring-primary/40",
      )}
    >
      {showHeader && (
        <div className="flex items-center gap-1 px-1 pt-1 text-caption font-semibold text-fg-2">
          <h2 className="m-0 text-caption font-semibold">
            {t("providerGroups.ungrouped", { defaultValue: "未分组" })}
          </h2>
        </div>
      )}
      {isEmptyDuringDrag ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-4 text-center text-caption text-fg-3">
          {t("providerGroups.dropToUngrouped", {
            defaultValue: "松手移出分组",
          })}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
