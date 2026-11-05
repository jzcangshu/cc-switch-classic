import { useGroupLayoutCommit } from "./useGroupLayoutCommit";
import { useGroupMenuActions } from "./useGroupMenuActions";
import { GroupActionMenu } from "./GroupActionMenu";
import {
  useCallback,
  useMemo,
  type ReactNode,
  type ComponentProps,
} from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  type SortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { Provider } from "@/types";
import type { AppId } from "@/lib/api";
import {
  renameGroup,
  UNGROUPED_ID,
  type ProviderGroupMenu,
} from "@/lib/providerGroups";
import type { ProviderGroupsApi } from "@/hooks/useProviderGroups";
import { ProviderSectionTitle } from "../ProviderSectionTitle";
import type {
  CardPresentation,
  ProviderSection,
} from "@/components/providers/presentation";
import {
  ProviderGroupContainer,
  type GroupMiniIcon,
} from "./ProviderGroupContainer";
import { UngroupedDropZone } from "./UngroupedDropZone";
import { GroupDragGhost } from "./GroupDragGhost";
import { useGroupDnd } from "./useGroupDnd";
import {
  createGroupDropAnimation,
  DRAG_LIFT_SCALE,
  GROUP_DRAG_LIFT_SCALE,
  GROUP_ENTER_SPRING,
} from "./groupMotion";

/**
 * 冻结 dnd-kit 的让位投影（iOS 手感的根因修复）：
 * 默认 verticalListSortingStrategy 会在 over 变化时即时给周围卡片让位
 * transform——完全没有悬停门槛，这是「规避过于灵敏」「先挤开再建组」的
 * 真正来源。冻结后一切让位只由悬停到点 fire 的 pending 变更驱动，
 * 动画由 framer layout FLIP 平滑完成（卡片 motion.div 自带）。
 */
const frozenDisplacementStrategy: SortingStrategy = () => ({
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
});

export interface GroupedProviderSectionsProps {
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
    flags?: {
      isMergeTarget?: boolean;
      isSettling?: boolean;
      dragDisabled?: boolean;
    },
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
  flatSensors: ComponentProps<typeof DndContext>["sensors"];
  flatModifiers: ComponentProps<typeof DndContext>["modifiers"];
}

/**
 * 认领板：合并意图武装时从锚点卡四周扩展生出的灰色底板（iOS 建文件夹预告，
 * 唯一的悬停视觉指引——除此之外拖拽期间无任何指示，只有物理让位）。
 * 渲染在卡片之下，卡片本体同时微缩，边缘从四周均匀露出。
 */
function MergePlate({ anchorId }: { anchorId: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      data-merge-plate
      layoutId={`group-surface-${anchorId}`}
      className="pointer-events-none absolute -inset-2 z-0 rounded-xl border border-border bg-black/[0.06] dark:bg-white/[0.09]"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 320, damping: 24 }
      }
    />
  );
}

/**
 * 分组视图：把主分区的卡片切成「分组容器 + 未分组」两个层级，其余分区原样跟在后面。
 * 拖拽模型 = dnd-kit 官方多容器模式：拖拽中 per-container items 即时更新（悬停
 * 门槛后），DragOverlay 拖影跟随，松手一次性提交（分组定义 + sortIndex 重写）。
 * 顶层组与未分组卡片共用稳定的父列表；预览升格只改变顺序。
 * 背景与锚点卡使用共享视觉身份，退出节点脱离布局，避免干扰落点测量。
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
  const reducedMotion = Boolean(useReducedMotion());
  // 拖影的抬升和落位由同一层变换管理，避免内外两次缩放和中心点补偿。
  const overlayModifiers = useMemo<Modifier[]>(
    () => [
      ({ transform, active }) => ({
        ...transform,
        x: 0,
        scaleX: reducedMotion
          ? 1
          : active?.data.current?.type === "group"
            ? GROUP_DRAG_LIFT_SCALE
            : DRAG_LIFT_SCALE,
        scaleY: reducedMotion
          ? 1
          : active?.data.current?.type === "group"
            ? GROUP_DRAG_LIFT_SCALE
            : DRAG_LIFT_SCALE,
      }),
    ],
    [reducedMotion],
  );
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

  const { commitLayout, isSaving } = useGroupLayoutCommit(
    appId,
    primaryProviders,
    sortedProviders,
    providerGroups,
  );

  const {
    sensors,
    collisionDetection,
    handlers,
    containers,
    containerOf,
    activeDrag,
    mergeTargetId,
    previewGroup,
    gapPreview,
    settlingId,
    finishDropAnimation,
    commitHeldLayout,
  } = useGroupDnd({
    reducedMotion,
    primaryProviders,
    groups,
    isGroupCollapsed,
    setGroupCollapsed,
    commitLayout,
    onFlatDragEnd,
  });

  const dropAnimation = useMemo(
    () => createGroupDropAnimation(finishDropAnimation, reducedMotion),
    [finishDropAnimation, reducedMotion],
  );

  const menu = useGroupMenuActions(
    { containers, containerOf },
    (pending, draft) => {
      void commitHeldLayout(pending, draft);
    },
    isSaving || Boolean(activeDrag),
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
          <ProviderSectionTitle section={section} />
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
              renderCard(item.provider, item.presentation, undefined, {
                dragDisabled: isSaving,
              }),
            )}
          </div>
        </SortableContext>
      )}
    </section>
  );

  const isCardDragging = activeDrag?.activeType === "card";

  // renderGroupedCard 必须先于下面的 useMemo 工厂（立即执行）定义（TDZ）
  const renderGroupedCard = (providerId: string) => {
    const presentation = presentationById.get(providerId);
    const provider = providerById.get(providerId);
    if (!presentation || !provider) return null;
    const isMergeTarget = mergeTargetId === providerId && isCardDragging;
    return (
      <div className="relative">
        <AnimatePresence>
          {isMergeTarget && (
            <MergePlate key="merge-plate" anchorId={providerId} />
          )}
        </AnimatePresence>
        {renderCard(provider, presentation, undefined, {
          isMergeTarget,
          isSettling: settlingId === providerId,
          dragDisabled: isSaving,
        })}
      </div>
    );
  };

  const groupContainers = useMemo(
    () =>
      containers.filter(
        (container) =>
          container.group !== null && container.id !== previewGroup?.groupId,
      ),
    [containers, previewGroup],
  );
  const ungroupedIds = useMemo(
    () => containers.find((c) => c.id === UNGROUPED_ID)?.providerIds ?? [],
    [containers],
  );

  /** 预览与正式组始终是同一父列表下的同一节点，整个组一起移动。 */
  const renderGroupContainer = (
    container: (typeof containers)[number],
    isPreview = false,
  ) => (
    <motion.div
      key={container.id}
      layout={reducedMotion ? false : "position"}
      data-group-preview={isPreview ? container.id : undefined}
      initial={false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0 }}
      transition={reducedMotion ? { duration: 0 } : GROUP_ENTER_SPRING}
    >
      <ProviderGroupContainer
        appId={appId}
        group={container.group!}
        surfaceId={
          isPreview ? `group-surface-${previewGroup?.anchorId}` : undefined
        }
        isCollapsed={isGroupCollapsed(container.id)}
        isSettling={settlingId === container.id}
        dragDisabled={isSaving}
        renameDisabled={isSaving}
        actions={
          <GroupActionMenu
            name={container.group!.name}
            actions={menu.groupActions(container.id)}
          />
        }
        onToggleCollapse={() =>
          setGroupCollapsed(container.id, !isGroupCollapsed(container.id))
        }
        onRename={(name) =>
          void saveAppGroups(renameGroup(groups, container.id, name)).catch(
            () => {},
          )
        }
        miniIcons={buildMiniIcons(container.providerIds)}
      >
        <SortableContext
          items={container.providerIds}
          strategy={frozenDisplacementStrategy}
        >
          <div className="space-y-3">
            {container.providerIds.map((id) => (
              <div key={id}>{renderGroupedCard(id)}</div>
            ))}
          </div>
        </SortableContext>
      </ProviderGroupContainer>
    </motion.div>
  );

  if (!primarySection) {
    // 主分区不存在（如路由视图故障转移开启时的 queue/rest）：整页按平铺渲染
    return <>{sections.map((section) => renderFlatSection(section))}</>;
  }

  // 未分组流：就地预览的新组插在锚点卡 B 原来的位置（iOS 文件夹在 App 原位弹出）
  const ungroupedRenderNodes = (() => {
    const nodes = ungroupedIds.map((id) => (
      <div key={id}>{renderGroupedCard(id)}</div>
    ));
    if (previewGroup) {
      const previewContainer = containers.find(
        (c) => c.id === previewGroup.groupId,
      );
      if (previewContainer?.group) {
        nodes.splice(
          Math.min(previewGroup.slotIndex, nodes.length),
          0,
          renderGroupContainer(previewContainer, true),
        );
      }
    }
    return nodes;
  })();

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
      return (
        <div style={widthStyle}>
          {renderPlainCard(item.provider, item.presentation)}
        </div>
      );
    }
    const container = containers.find((c) => c.id === activeDrag.activeId);
    if (!container?.group) return null;
    return (
      <GroupDragGhost
        appId={appId}
        group={container.group}
        miniIcons={buildMiniIcons(container.providerIds)}
        width={activeDrag.overlayWidth ?? undefined}
      />
    );
  })();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={(event) => {
        if (!isSaving) handlers.onDragStart(event);
      }}
      onDragMove={handlers.onDragMove}
      onDragOver={handlers.onDragOver}
      onDragEnd={handlers.onDragEnd}
      onDragCancel={handlers.onDragCancel}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      // 关闭拖拽自动滚动：页面高度有限，滚动会移动指针下的内容、
      // 破坏 iOS 式「静止悬停才互动」的判定（移动端化行为与桌面场景不符）
      autoScroll={false}
    >
      <ProviderSectionTitle section={primarySection} />
      <SortableContext
        items={[
          ...groupContainers.map((container) => container.id),
          ...ungroupedIds,
          ...(previewGroup ? [previewGroup.groupId] : []),
        ]}
        strategy={
          activeDrag?.activeType === "group"
            ? verticalListSortingStrategy
            : frozenDisplacementStrategy
        }
      >
        <div className="space-y-3">
          <AnimatePresence initial={false} mode="popLayout">
            {[
              ...groupContainers.flatMap((container) => [
                ...(gapPreview?.beforeGroupId === container.id
                  ? [
                      <motion.div
                        key={`gap-preview-${container.id}`}
                        aria-hidden
                        data-gap-preview
                        initial={{ height: 0, opacity: 0 }}
                        animate={{
                          height: activeDrag?.overlayHeight ?? 84,
                          opacity: 1,
                        }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={
                          reducedMotion ? { duration: 0 } : GROUP_ENTER_SPRING
                        }
                        className="overflow-hidden"
                      />,
                    ]
                  : []),
                renderGroupContainer(container),
              ]),
              ...(groupContainers.length > 0
                ? [
                    <motion.h2
                      key="ungrouped-heading"
                      layout={reducedMotion ? false : "position"}
                      className="px-1 pt-1 text-caption font-semibold text-fg-2"
                    >
                      {t("providerGroups.ungrouped", {
                        defaultValue: "未分组",
                      })}
                    </motion.h2>,
                  ]
                : []),
              ...ungroupedRenderNodes,
            ]}
          </AnimatePresence>
          <UngroupedDropZone
            active={Boolean(
              isCardDragging &&
                activeDrag &&
                presentationById.has(activeDrag.activeId),
            )}
            fillViewport={otherSections.length === 0}
            movingOut={Boolean(
              activeDrag && containerOf[activeDrag.activeId] !== UNGROUPED_ID,
            )}
          />
        </div>
      </SortableContext>

      {otherSections.map((section) => renderFlatSection(section))}

      {createPortal(
        <DragOverlay
          dropAnimation={dropAnimation}
          modifiers={overlayModifiers}
          adjustScale
          style={{ transformOrigin: "0 0" }}
        >
          {overlayContent}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
