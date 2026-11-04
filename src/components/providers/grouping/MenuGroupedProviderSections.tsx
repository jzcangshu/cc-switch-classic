import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { closestCenter, DndContext } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { resolveGroupedLayout, renameGroup } from "@/lib/providerGroups";
import type { GroupedProviderSectionsProps } from "./GroupedProviderSections";
import { ProviderGroupContainer } from "./ProviderGroupContainer";
import { GroupActionMenu } from "./GroupActionMenu";
import { CreateProviderGroupDialog } from "./CreateProviderGroupDialog";
import { useGroupMenuActions } from "./useGroupMenuActions";
import { useGroupLayoutCommit } from "./useGroupLayoutCommit";
import { ProviderSectionTitle } from "../ProviderSectionTitle";

/** 桌面模式的主区没有拖动传感器；其他业务分区保留各自的排序。 */
export function MenuGroupedProviderSections({
  appId,
  sections,
  primaryKey,
  sortedProviders,
  renderCard,
  providerGroups,
  onFlatDragEnd,
  flatSensors,
  flatModifiers,
}: GroupedProviderSectionsProps) {
  const { t } = useTranslation();
  const primary = sections.find((s) => s.key === primaryKey);
  const providers = useMemo(
    () => primary?.items.map((item) => item.provider) ?? [],
    [primary],
  );
  const byId = new Map(primary?.items.map((item) => [item.provider.id, item]));
  const layout = resolveGroupedLayout(providerGroups.groups, providers);
  const { commitLayout, isSaving } = useGroupLayoutCommit(
    appId,
    providers,
    sortedProviders,
    providerGroups,
  );
  const menu = useGroupMenuActions(
    layout,
    (pending, groups) => {
      void commitLayout(pending, groups);
    },
    isSaving,
  );
  return (
    <>
      {primary && <ProviderSectionTitle section={primary} />}
      {layout.containers.map((container) => {
        const cards = (
          <div className="space-y-3">
            {container.providerIds.map((id) => {
              const item = byId.get(id);
              return item ? (
                <Fragment key={id}>
                  {renderCard(
                    item.provider,
                    item.presentation,
                    menu.buildGroupMenu(id),
                  )}
                </Fragment>
              ) : null;
            })}
          </div>
        );
        if (!container.group)
          return (
            <section
              key={container.id}
              className="space-y-3"
              data-provider-group="ungrouped"
            >
              {providerGroups.groups.length > 0 &&
                container.providerIds.length > 0 && (
                  <h2 className="px-1 text-caption font-semibold text-fg-2">
                    {t("providerGroups.ungrouped")}
                  </h2>
                )}
              {cards}
            </section>
          );
        const group = container.group;
        return (
          <ProviderGroupContainer
            key={group.id}
            appId={appId}
            group={group}
            dragEnabled={false}
            renameDisabled={isSaving}
            isCollapsed={providerGroups.isGroupCollapsed(group.id)}
            onToggleCollapse={() =>
              providerGroups.setGroupCollapsed(
                group.id,
                !providerGroups.isGroupCollapsed(group.id),
              )
            }
            onRename={(name) => {
              void providerGroups
                .saveAppGroups(
                  renameGroup(providerGroups.groups, group.id, name),
                )
                .catch(() => {});
            }}
            actions={
              <GroupActionMenu
                name={group.name}
                actions={menu.groupActions(group.id)}
              />
            }
            miniIcons={container.providerIds.flatMap((id) => {
              const p = byId.get(id)?.provider;
              return p
                ? [
                    {
                      id: p.id,
                      name: p.name,
                      icon: p.icon,
                      iconColor: p.iconColor,
                    },
                  ]
                : [];
            })}
          >
            {cards}
          </ProviderGroupContainer>
        );
      })}
      <DndContext
        sensors={flatSensors}
        modifiers={flatModifiers}
        collisionDetection={closestCenter}
        onDragEnd={onFlatDragEnd}
      >
        {sections
          .filter((s) => s.key !== primaryKey)
          .map((section) => (
            <section key={section.key} className="space-y-3">
              <ProviderSectionTitle section={section} />
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
          ))}
      </DndContext>
      <CreateProviderGroupDialog
        open={menu.creatingFor !== null}
        onClose={() => menu.setCreatingFor(null)}
        onCreate={menu.create}
      />
    </>
  );
}
