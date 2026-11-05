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
      rect: {
        left: 20,
        top: 20,
        width: 900 * DRAG_LIFT_SCALE,
        height: 84 * DRAG_LIFT_SCALE,
      },
      node: { animate },
    },
    transform: {
      x: 0,
      y: 80,
      scaleX: DRAG_LIFT_SCALE,
      scaleY: DRAG_LIFT_SCALE,
    },
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
      expect(animate.mock.calls[0][0][1].transform).toBe(
        "translate3d(0px, 160px, 0) scaleX(1) scaleY(1)",
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

describe("drop geometry", () => {
  it("lands on an inset group's narrower card without a second lift compensation", async () => {
    const { args, animate, animation } = fixture();
    args.active.rect = {
      left: 32,
      top: 200,
      width: 876,
      height: 84,
    } as typeof args.active.rect;
    const done = (
      createGroupDropAnimation(vi.fn(), false) as DropAnimationFunction
    )(args);
    const last = animate.mock.calls[0][0][1].transform as string;
    const values =
      /translate3d\(([-.\d]+)px, ([-.\d]+)px, 0\) scaleX\(([-.\d]+)\) scaleY\(([-.\d]+)\)/.exec(
        last,
      )!;
    expect(20 + Number(values[1])).toBe(32);
    expect(
      (900 * DRAG_LIFT_SCALE * Number(values[3])) / DRAG_LIFT_SCALE,
    ).toBeCloseTo(876);
    animation.onfinish!();
    await done;
  });
});
