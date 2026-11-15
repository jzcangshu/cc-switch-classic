import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CollisionDetection } from "@dnd-kit/core";
import {
  AutoScrollActivator,
  getScrollableAncestors,
} from "@dnd-kit/core";
import {
  AUTO_SCROLL_ACCELERATION,
  AUTO_SCROLL_TICK_MS,
  AUTO_SCROLL_ZONE_MAX_RATIO,
  AUTO_SCROLL_ZONE_PX,
  SCROLL_FREEZE_RELEASE_PX,
  SCROLL_SETTLE_MS,
  resolveZoneRatio,
  useDragAutoScroll,
} from "@/components/providers/grouping/dragAutoScroll";

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  const container = {
    getBoundingClientRect: () => ({ height: 900 }),
  };
  return {
    ...actual,
    getScrollableAncestors: vi.fn(() => [container]),
  };
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(getScrollableAncestors).mockClear();
});

describe("resolveZoneRatio", () => {
  it("converts the fixed pixel band into a fraction of the container", () => {
    expect(resolveZoneRatio(900)).toBeCloseTo(AUTO_SCROLL_ZONE_PX / 900);
  });

  it("clamps so a short container never loses half its height to the band", () => {
    expect(resolveZoneRatio(100)).toBe(AUTO_SCROLL_ZONE_MAX_RATIO);
  });

  it("falls back to the clamp for degenerate measurements", () => {
    expect(resolveZoneRatio(0)).toBe(AUTO_SCROLL_ZONE_MAX_RATIO);
    expect(resolveZoneRatio(Number.NaN)).toBe(AUTO_SCROLL_ZONE_MAX_RATIO);
  });
});

describe("useDragAutoScroll options", () => {
  it("measures the scrollable ancestor dnd-kit will actually scroll", () => {
    const rootElement = document.createElement("div");
    const { result } = renderHook(() => useDragAutoScroll());
    expect(result.current.autoScroll).toBeUndefined();

    act(() => result.current.attachScrollRoot(rootElement));
    expect(result.current.autoScroll).toEqual({
      threshold: { x: 0.2, y: AUTO_SCROLL_ZONE_PX / 900 },
      acceleration: AUTO_SCROLL_ACCELERATION,
      interval: AUTO_SCROLL_TICK_MS,
      activator: AutoScrollActivator.Pointer,
    });
  });

  it("drops the band when the list root detaches", () => {
    const rootElement = document.createElement("div");
    const { result } = renderHook(() => useDragAutoScroll());
    act(() => result.current.attachScrollRoot(rootElement));
    act(() => result.current.attachScrollRoot(null));
    expect(result.current.autoScroll).toBeUndefined();
  });
});

type CollisionArgs = Parameters<CollisionDetection>[0];

function pointerArgs(x: number, y = 0): CollisionArgs {
  return { pointerCoordinates: { x, y } } as unknown as CollisionArgs;
}

function setup() {
  vi.useFakeTimers();
  const base = vi.fn(
    () => [{ id: "b" }] as unknown as ReturnType<CollisionDetection>,
  );
  const hook = renderHook(() => useDragAutoScroll());
  const controls = hook.result.current;
  const frozen = controls.freezeCollision(base);
  return { hook, controls, frozen, base };
}

describe("scroll freeze state machine", () => {
  it("runs the base collision detection while nothing scrolls", () => {
    const { frozen, base } = setup();
    expect(frozen(pointerArgs(0))).toEqual([{ id: "b" }]);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("freezes the last result while content moves under a stationary pointer", () => {
    const { frozen, base, controls } = setup();
    expect(frozen(pointerArgs(0))).toEqual([{ id: "b" }]);
    act(() => controls.notifyDragScroll());
    // 指针没动：即使几何已经随滚动变化，也停在滚动前的落点上
    expect(frozen(pointerArgs(0))).toEqual([{ id: "b" }]);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("releases the freeze as soon as the pointer moves for real", () => {
    const { frozen, base, controls } = setup();
    expect(frozen(pointerArgs(0))).toEqual([{ id: "b" }]);
    act(() => controls.notifyDragScroll());
    expect(frozen(pointerArgs(0))).toEqual([{ id: "b" }]);
    // 用户在定位：立即解冻并重算，不等安定窗口
    expect(
      frozen(pointerArgs(0, SCROLL_FREEZE_RELEASE_PX + 5)),
    ).toEqual([{ id: "b" }]);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("re-runs collision against the remeasured rects once scrolling settles", () => {
    const { hook, frozen, base, controls } = setup();
    expect(hook.result.current.settleGeneration).toBe(0);
    expect(frozen(pointerArgs(0))).toEqual([{ id: "b" }]);
    act(() => controls.notifyDragScroll());
    expect(frozen(pointerArgs(0))).toEqual([{ id: "b" }]);

    act(() => vi.advanceTimersByTime(SCROLL_SETTLE_MS));
    expect(hook.result.current.settleGeneration).toBe(1);
    // 安定后冻结解除：base 用重测矩形重算
    expect(frozen(pointerArgs(0))).toEqual([{ id: "b" }]);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it("stops an in-flight settle timer when the hook unmounts", () => {
    const { hook } = setup();
    act(() => hook.result.current.notifyDragScroll());
    hook.unmount();
    // 卸载后残留回调不得再 bump 状态： advancing timers 不应抛错
    expect(() => vi.advanceTimersByTime(SCROLL_SETTLE_MS)).not.toThrow();
  });
});
