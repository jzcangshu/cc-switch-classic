import type { DropAnimation } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export const CARD_SPRING = {
  type: "spring",
  stiffness: 380,
  damping: 40,
} as const;
export const GROUP_ENTER_SPRING = {
  type: "spring",
  stiffness: 320,
  damping: 30,
} as const;
export const DROP_ANIMATION = {
  duration: 240,
  easing: "cubic-bezier(0.2, 0.8, 0.3, 1)",
} as const;
export const DRAG_LIFT_SCALE = 1.025;
export const GROUP_DRAG_LIFT_SCALE = 1.02;

/** 动画完成或被打断都交还真卡；不能让一次 cancel 挂住拖影清理。 */
export function createGroupDropAnimation(
  onComplete: () => void,
  reducedMotion: boolean,
): DropAnimation {
  return async ({ active, dragOverlay, transform }) => {
    try {
      if (
        reducedMotion ||
        dragOverlay.rect.width <= 0 ||
        dragOverlay.rect.height <= 0
      )
        return;
      const isCard = active.data.current?.type === "card";
      const from = CSS.Transform.toString(transform);
      const to = CSS.Transform.toString({
        x: transform.x - (dragOverlay.rect.left - active.rect.left),
        y: transform.y - (dragOverlay.rect.top - active.rect.top),
        scaleX: isCard
          ? (active.rect.width * transform.scaleX) / dragOverlay.rect.width
          : 1,
        scaleY: isCard
          ? (active.rect.height * transform.scaleY) / dragOverlay.rect.height
          : 1,
      });
      if (from === to) return;
      const animation = dragOverlay.node.animate(
        [{ transform: from }, { transform: to }],
        { ...DROP_ANIMATION, fill: "forwards" },
      );
      await new Promise<void>((resolve) => {
        animation.onfinish = () => resolve();
        animation.oncancel = () => resolve();
      });
    } finally {
      onComplete();
    }
  };
}
