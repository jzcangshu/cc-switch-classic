import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProviderGroupDefinition } from "@/types";
import {
  createGroupWithProviders,
  layoutToPending,
  moveProviderInPending,
  reorderGroups,
  UNGROUPED_ID,
  type GroupedLayout,
  type PendingLayout,
  type ProviderGroupMenu,
} from "@/lib/providerGroups";

/** 菜单操作只生成布局，拖拽和菜单共用持久化与成员模型。 */
export function useGroupMenuActions(
  layout: GroupedLayout,
  commit: (pending: PendingLayout, groups: ProviderGroupDefinition[]) => void,
  disabled: boolean,
) {
  const { t } = useTranslation();
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const groups = layout.containers.flatMap((c) => (c.group ? [c.group] : []));
  const submit = (pending: PendingLayout, nextGroups = groups) => {
    if (!disabled) commit(pending, nextGroups);
  };
  const move = (providerId: string, containerId: string) => {
    if (layout.containerOf[providerId] === containerId) return;
    submit(
      moveProviderInPending(
        layoutToPending(layout),
        providerId,
        containerId,
        null,
      ),
    );
  };
  const moveCard = (providerId: string, direction: -1 | 1) => {
    const pending = layoutToPending(layout);
    const ids = pending[layout.containerOf[providerId]];
    const index = ids?.indexOf(providerId) ?? -1;
    if (
      !ids ||
      index < 0 ||
      index + direction < 0 ||
      index + direction >= ids.length
    )
      return;
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    submit(pending);
  };
  const create = (name: string) => {
    if (!creatingFor || !name.trim() || disabled) return;
    const pending = layoutToPending(layout);
    const nextGroups = createGroupWithProviders(
      groups,
      [creatingFor],
      name.trim(),
    );
    const added = nextGroups[nextGroups.length - 1];
    pending[added.id] = [];
    submit(
      moveProviderInPending(pending, creatingFor, added.id, null),
      nextGroups,
    );
    setCreatingFor(null);
  };
  const groupActions = (groupId: string) => {
    const index = groups.findIndex((group) => group.id === groupId);
    return [
      ...([-1, 1] as const).map((direction) => ({
        key: direction < 0 ? "up" : "down",
        label: t(
          direction < 0 ? "providerGroups.moveUp" : "providerGroups.moveDown",
        ),
        disabled:
          disabled ||
          index + direction < 0 ||
          index + direction >= groups.length,
        onSelect: () => {
          const target = groups[index + direction];
          if (target)
            submit(
              layoutToPending(layout),
              reorderGroups(groups, groupId, target.id),
            );
        },
      })),
      {
        key: "dissolve",
        label: t("providerGroups.dissolve"),
        disabled,
        onSelect: () => {
          const pending = layoutToPending(layout);
          pending[UNGROUPED_ID] = [
            ...pending[UNGROUPED_ID],
            ...(pending[groupId] ?? []),
          ];
          delete pending[groupId];
          submit(
            pending,
            groups.filter((group) => group.id !== groupId),
          );
        },
      },
    ];
  };
  const buildGroupMenu = (providerId: string): ProviderGroupMenu => {
    const current = layout.containerOf[providerId];
    const ids =
      layout.containers.find((c) => c.id === current)?.providerIds ?? [];
    const index = ids.indexOf(providerId);
    return {
      options: layout.containers
        .filter((c) => c.group || current !== UNGROUPED_ID)
        .map((c) => ({
          key: c.id,
          label: c.group?.name ?? t("providerGroups.ungrouped"),
          checked: current === c.id,
          disabled: disabled || current === c.id,
          onSelect: () => move(providerId, c.id),
        })),
      actions: [
        {
          key: "create",
          label: t("providerGroups.create"),
          disabled,
          onSelect: () => setCreatingFor(providerId),
        },
        ...([-1, 1] as const).map((direction) => ({
          key: direction < 0 ? "up" : "down",
          label: t(
            direction < 0 ? "providerGroups.moveUp" : "providerGroups.moveDown",
          ),
          disabled:
            disabled ||
            index + direction < 0 ||
            index + direction >= ids.length,
          onSelect: () => moveCard(providerId, direction),
        })),
      ],
    };
  };
  return { creatingFor, setCreatingFor, create, buildGroupMenu, groupActions };
}
