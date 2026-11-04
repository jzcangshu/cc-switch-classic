import { describe, expect, it, vi } from "vitest";
import type { DropAnimationFunction } from "@dnd-kit/core";
import {
  createGroupDropAnimation,
  DROP_ANIMATION,
  DRAG_LIFT_SCALE,
} from "@/components/providers/grouping/groupMotion";
function fixture() {
  const animation = {
    onfinish: null as (() => void) | null,
    oncancel: null as (() => void) | null,
  };
  const animate = vi.fn(
    (_frames: Keyframe[], _options: KeyframeAnimationOptions) => animation,
  );
  const args = {
    active: {
      data: { current: { type: "card" } },
      rect: { left: 20, top: 100, width: 900, height: 84 },
    },
    dragOverlay: {
      rect: { left: 20, top: 20, width: 900, height: 84 },
      node: { animate },
    },
    transform: { x: 0, y: 80, scaleX: 1, scaleY: 1 },
  } as unknown as Parameters<DropAnimationFunction>[0];
  return { animation, animate, args };
}
describe("drop animation lifecycle", () => {
  it.each(["onfinish", "oncancel"] as const)(
    "always releases the real card on %s",
    async (event) => {
      const done = vi.fn();
      const { animation, animate, args } = fixture();
      const promise = (
        createGroupDropAnimation(done, false) as DropAnimationFunction
      )(args);
      expect(done).not.toHaveBeenCalled();
      expect(animate.mock.calls[0][1]).toMatchObject({
        duration: DROP_ANIMATION.duration,
      });
      expect(animate.mock.calls[0][0][1].transform).toContain(
        String(1 / DRAG_LIFT_SCALE),
      );
      animation[event]!();
      await promise;
      expect(done).toHaveBeenCalledOnce();
    },
  );
  it("reduced motion skips animation and completes immediately", async () => {
    const done = vi.fn();
    const { animate, args } = fixture();
    await (createGroupDropAnimation(done, true) as DropAnimationFunction)(args);
    expect(animate).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledOnce();
  });
});
