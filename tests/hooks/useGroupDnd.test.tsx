import { UNGROUPED_ID } from "@/lib/providerGroups";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DragStartEvent,
  DragEndEvent,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  useGroupDnd,
  MERGE_DWELL_MS,
  EXPAND_DWELL_MS,
} from "@/components/providers/grouping/useGroupDnd";
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    pointerWithin: ({ pointerCoordinates, droppableContainers }: any) =>
      pointerCoordinates?.x < 0
        ? []
        : [{ id: droppableContainers[1]?.id ?? "b" }],
    closestCenter: () => [],
  };
});
const providers = ["a", "b"].map((id) => ({
  id,
  name: id,
  settingsConfig: {},
}));
const start = {
  active: {
    id: "a",
    data: { current: { type: "card" } },
    rect: { current: { initial: { width: 900, height: 84 } } },
  },
} as unknown as DragStartEvent;
const end = {
  active: { id: "a" },
  over: { id: "b", data: { current: { type: "card" } } },
} as unknown as DragEndEvent;
function collision(x = 0, target: "card" | "group" = "card") {
  return {
    pointerCoordinates: { x, y: 50 },
    droppableContainers: [
      {
        id: "a",
        data: { current: { type: "card" } },
        rect: { current: { top: 0, height: 100 } },
      },
      {
        id: target === "card" ? "b" : "g",
        data: { current: { type: target } },
        rect: { current: { top: 0, height: 100 } },
      },
    ],
  } as unknown as Parameters<CollisionDetection>[0];
}
function setup(collapsed = false, reducedMotion = false, keyboard = false) {
  vi.useFakeTimers();
  const commitLayout = vi.fn();
  const setGroupCollapsed = vi.fn();
  const hook = renderHook(() =>
    useGroupDnd({
      primaryProviders: providers,
      groups: collapsed ? [{ id: "g", name: "Work", providerIds: ["b"] }] : [],
      isGroupCollapsed: () => collapsed,
      setGroupCollapsed,
      commitLayout,
      onFlatDragEnd: vi.fn(),
      reducedMotion,
    }),
  );
  act(() =>
    hook.result.current.handlers.onDragStart(
      keyboard
        ? { ...start, activatorEvent: new KeyboardEvent("keydown") }
        : start,
    ),
  );
  return { ...hook, commitLayout, setGroupCollapsed };
}
afterEach(() => vi.useRealTimers());
describe("group drag timing", () => {
  it("collision measurement alone does not schedule a visual change before the sensor event", () => {
    const { result } = setup();
    act(() => result.current.collisionDetection(collision()));
    act(() => vi.advanceTimersByTime(MERGE_DWELL_MS));
    expect(result.current.previewGroup).toBeNull();
    act(() => result.current.handlers.onDragMove());
    act(() => vi.advanceTimersByTime(MERGE_DWELL_MS));
    expect(result.current.previewGroup).not.toBeNull();
  });
  it("does not let slow continuous motion accidentally create a group", () => {
    const { result } = setup();
    act(() => {
      result.current.collisionDetection(collision(0));
      result.current.handlers.onDragMove();
    });
    for (const x of [4, 8, 12, 16]) {
      act(() => vi.advanceTimersByTime(100));
      act(() => {
        result.current.collisionDetection(collision(x));
        result.current.handlers.onDragMove();
      });
    }
    expect(result.current.previewGroup).toBeNull();
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.previewGroup).toBeNull();
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.previewGroup).not.toBeNull();
  });
  it("disarms a hover after leaving all targets", () => {
    const { result, commitLayout } = setup();
    act(() => {
      result.current.collisionDetection(collision());
      result.current.handlers.onDragMove();
    });
    act(() => vi.advanceTimersByTime(100));
    act(() => {
      result.current.collisionDetection(collision(-1));
      result.current.handlers.onDragMove();
    });
    act(() => vi.advanceTimersByTime(MERGE_DWELL_MS));
    expect(result.current.previewGroup).toBeNull();
    act(() => result.current.handlers.onDragCancel());
    expect(commitLayout).not.toHaveBeenCalled();
  });
  it("keeps a new group in place until the drop animation finishes", () => {
    const { result, commitLayout } = setup();
    act(() => {
      result.current.collisionDetection(collision());
      result.current.handlers.onDragMove();
    });
    act(() => vi.advanceTimersByTime(MERGE_DWELL_MS));
    expect(result.current.previewGroup).not.toBeNull();
    act(() => result.current.handlers.onDragEnd(end));
    expect(commitLayout).toHaveBeenCalledOnce();
    expect(result.current.settlingId).toBe("a");
    expect(result.current.previewGroup).not.toBeNull();
    act(() => result.current.finishDropAnimation());
    expect(result.current.settlingId).toBeNull();
    expect(result.current.previewGroup).toBeNull();
  });
  it("cancelling restores groups expanded during hovering", () => {
    const { result, setGroupCollapsed, commitLayout } = setup(true);
    act(() => {
      result.current.collisionDetection(collision(0, "group"));
      result.current.handlers.onDragMove();
    });
    act(() => vi.advanceTimersByTime(EXPAND_DWELL_MS));
    expect(setGroupCollapsed).toHaveBeenCalledWith("g", false);
    act(() => result.current.handlers.onDragCancel());
    expect(setGroupCollapsed).toHaveBeenLastCalledWith("g", true);
    expect(commitLayout).not.toHaveBeenCalled();
  });
  it("reduced motion never hides a released card", () => {
    const { result } = setup(false, true);
    act(() => {
      result.current.collisionDetection(collision());
      result.current.handlers.onDragMove();
    });
    act(() => vi.advanceTimersByTime(MERGE_DWELL_MS));
    act(() => result.current.handlers.onDragEnd(end));
    expect(result.current.settlingId).toBeNull();
    expect(result.current.previewGroup).toBeNull();
  });
});

describe("group drag completion", () => {
  it("keyboard sorting commits the chosen card without hover timing or accidental grouping", () => {
    const { result, commitLayout } = setup(false, false, true);
    act(() => result.current.handlers.onDragEnd(end));
    expect(commitLayout).toHaveBeenCalledWith(
      { [UNGROUPED_ID]: ["b", "a"] },
      [],
    );
    expect(result.current.previewGroup).toBeNull();
  });
  it("an old drop callback cannot release the next drop", () => {
    const { result } = setup();
    const oldComplete = result.current.finishDropAnimation;
    act(() => result.current.handlers.onDragEnd(end));
    act(() => result.current.handlers.onDragStart(start));
    act(() => result.current.handlers.onDragEnd(end));
    act(() => oldComplete());
    expect(result.current.settlingId).toBe("a");
    act(() => result.current.finishDropAnimation());
    expect(result.current.settlingId).toBeNull();
  });
});
