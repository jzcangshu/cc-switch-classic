import { UNGROUPED_ID } from "@/lib/providerGroups";

type DropRect = { top: number; bottom: number; left: number; right: number };

export interface GroupDropArea {
  id: string;
  type: "card" | "group";
  containerId: string | null;
  rect: DropRect;
}

interface WhitespaceInsertion {
  containerId: string;
  anchorId: string | null;
  position: "before" | "after";
}

/** 最后一个分组外缘到未分组第一张卡之间（含标题）全部属于未分组头部。 */
function isUngroupedHeadPoint(
  pointer: { x: number; y: number },
  groupRects: DropRect[],
  firstCardRect: DropRect | null,
): boolean {
  if (!firstCardRect || groupRects.length === 0) return false;
  const lastGroup = groupRects.reduce((last, rect) =>
    rect.bottom > last.bottom ? rect : last,
  );
  return (
    pointer.y > lastGroup.bottom &&
    pointer.y < firstCardRect.top &&
    pointer.x >= Math.min(lastGroup.left, firstCardRect.left) &&
    pointer.x <= Math.max(lastGroup.right, firstCardRect.right)
  );
}

/** 同一容器相邻卡片间的空白属于插入落点，不能跨过别的容器或接管组头。 */
function findCardGapTarget(
  pointer: { x: number; y: number },
  cards: GroupDropArea[],
  activeId: string,
  containerUnderPointer: string | null,
): GroupDropArea | null {
  const ordered = [...cards].sort((a, b) => a.rect.top - b.rect.top);
  for (let index = 1; index < ordered.length; index += 1) {
    const upper = ordered[index - 1];
    const lower = ordered[index];
    if (
      upper.containerId !== lower.containerId ||
      (containerUnderPointer !== null &&
        upper.containerId !== containerUnderPointer)
    )
      continue;
    if (
      pointer.y > upper.rect.bottom &&
      pointer.y < lower.rect.top &&
      pointer.x >= Math.max(upper.rect.left, lower.rect.left) &&
      pointer.x <= Math.min(upper.rect.right, lower.rect.right)
    ) {
      // 同一插入槽始终选非活动卡片作锚点；占位本身不接管上一轮意图。
      return lower.id === activeId ? upper : lower;
    }
  }
  return null;
}

/** 空白只补充明确插入槽；卡片本体、其他分区及分组内部仍保留原有语义。 */
export function resolveWhitespaceInsertion(
  pointer: { x: number; y: number },
  areas: GroupDropArea[],
  activeId: string,
  ungroupedIds: string[],
): WhitespaceInsertion | null {
  const containsPointer = ({ rect }: GroupDropArea) =>
    pointer.x >= rect.left &&
    pointer.x <= rect.right &&
    pointer.y >= rect.top &&
    pointer.y <= rect.bottom;
  const cards = areas.filter((area) => area.type === "card");
  if (cards.some(containsPointer)) return null;
  const groups = areas.filter((area) => area.type === "group");
  const firstUngrouped = cards.find((card) => card.id === ungroupedIds[0]);
  if (
    isUngroupedHeadPoint(
      pointer,
      groups.map((group) => group.rect),
      firstUngrouped?.rect ?? null,
    )
  ) {
    return {
      containerId: UNGROUPED_ID,
      anchorId: ungroupedIds.find((id) => id !== activeId) ?? null,
      position: "before",
    };
  }
  const groupUnderPointer = groups.find(containsPointer);
  const anchor = findCardGapTarget(
    pointer,
    cards,
    activeId,
    groupUnderPointer?.id ?? null,
  );
  return anchor?.containerId
    ? {
        containerId: anchor.containerId,
        anchorId: anchor.id,
        position: pointer.y < anchor.rect.top ? "before" : "after",
      }
    : null;
}
