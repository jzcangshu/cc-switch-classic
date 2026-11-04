import { useCallback, useMemo, type ReactNode } from "react";
import {
  DndContext,
  MeasuringStrategy,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Provider, ProviderGroupDefinition } from "@/types";
import type { AppId } from "@/lib/api";
import { providersApi } from "@/lib/api/providers";
import { isProxyAppId } from "@/config/appConfig";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  buildSortIndexUpdates,
  moveProviderInPending,
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
import type { ProviderSection } from "@/components/providers/presentation";
import {
  ProviderGroupContainer,
  type GroupMiniIcon,
} from "./ProviderGroupContainer";
import { useGroupDnd } from "./useGroupDnd";

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
    presentation: ProviderSection["items"][number]["presentation"],
    groupMenu?: ProviderGroupMenu,
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
 * 分组视图：把主分区的卡片切成「分组容器 + 未分组」两个层级，其余分区原样跟在后面。
 * 拖拽/悬停/菜单的所有结构变更都经 commitLayout 统一提交（分组定义 + sortIndex 重写）。
 */
export function GroupedProviderSections({
  appId,
  sections,
  primaryKey,
  sortedProviders,
  renderCard,
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
    const map = new Map<string, ProviderSection["items"][number]>();
    for (const item of primaryItems) map.set(item.provider.id, item);
    return map;
  }, [primaryItems]);
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
      const layout = resolveGroupedLayout(nextGroups, primaryProviders);
      void commitSortIndexes(
        buildSortIndexUpdates(layout.containers, validIds, sortedProviders),
      );
    },
    [primaryProviders, saveAppGroups, sortedProviders, commitSortIndexes],
  );

  const {
    sensors,
    collisionDetection,
    handlers,
    containers,
    containerOf,
    activeDrag,
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

  const renderGroupedCard = useCallback(
    (providerId: string) => {
      const item = presentationById.get(providerId);
      const provider = providerById.get(providerId);
      if (!item || !provider) return null;
      return renderCard(provider, item.presentation, buildGroupMenu(provider));
    },
    [presentationById, providerById, renderCard, buildGroupMenu],
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

  if (!primarySection) {
    // 主分区不存在（如路由视图故障转移开启时的 queue/rest）：整页按平铺渲染
    return <>{sections.map((section) => renderFlatSection(section))}</>;
  }

  const isCardDragging = activeDrag?.activeType === "card";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handlers.onDragStart}
      onDragOver={handlers.onDragOver}
      onDragEnd={handlers.onDragEnd}
      onDragCancel={handlers.onDragCancel}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
      {containers.map((container) =>
        container.group ? (
          <ProviderGroupContainer
            key={container.id}
            appId={appId}
            group={container.group}
            isDragOver={Boolean(
              isCardDragging &&
                activeDrag &&
                containerOf[activeDrag.activeId] === container.id,
            )}
            isCollapsed={isGroupCollapsed(container.id)}
            onToggleCollapse={() =>
              setGroupCollapsed(container.id, !isGroupCollapsed(container.id))
            }
            onRename={(name) =>
              saveAppGroups(renameGroup(groups, container.id, name))
            }
            miniIcons={container.providerIds
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
              )}
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
        ) : container.providerIds.length > 0 || isCardDragging ? (
          <UngroupedContainer
            key={container.id}
            showHeader={groups.length > 0}
            isEmptyDuringDrag={
              isCardDragging && container.providerIds.length === 0
            }
            isDragOver={Boolean(
              isCardDragging &&
                activeDrag &&
                containerOf[activeDrag.activeId] === container.id,
            )}
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
          </UngroupedContainer>
        ) : null,
      )}
      {otherSections.map((section) => renderFlatSection(section))}
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
