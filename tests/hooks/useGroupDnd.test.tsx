import { UNGROUPED_ID } from "@/lib/providerGroups";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProviderGroupDefinition } from "@/types";
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
function collision(x = 0, target: "card" | "group" | "ungrouped" = "card") {
  return {
    pointerCoordinates: { x, y: 50 },
    droppableContainers: [
      {
        id: "a",
        data: { current: { type: "card" } },
        rect: { current: { top: 0, height: 100 } },
      },
      {
        id:
          target === "card" ? "b" : target === "ungrouped" ? UNGROUPED_ID : "g",
        data: { current: { type: target } },
        rect: { current: { top: 0, height: 100 } },
      },
    ],
  } as unknown as Parameters<CollisionDetection>[0];
}
function setup(collapsed = false, reducedMotion = false, keyboard = false) {
  vi.useFakeTimers();
  const commitLayout = vi.fn().mockResolvedValue(true);
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

describe("bottom whitespace drop", () => {
  it.each([0, 700])("appends to the end after %i ms of dwell", (dwell) => {
    const { result, commitLayout } = setup();
    act(() => {
      result.current.collisionDetection(collision(0, "ungrouped"));
      result.current.handlers.onDragMove();
    });
    act(() => vi.advanceTimersByTime(dwell));
    act(() =>
      result.current.handlers.onDragEnd({
        ...end,
        over: {
          id: UNGROUPED_ID,
          data: { current: { type: "ungrouped" } },
        },
      } as unknown as DragEndEvent),
    );
    expect(commitLayout).toHaveBeenCalledWith(
      { [UNGROUPED_ID]: ["b", "a"] },
      [],
    );
    expect(result.current.previewGroup).toBeNull();
  });
  it("moves a grouped card to the ungrouped tail without treating the last card as a merge target", () => {
    const { result, commitLayout } = setup(true);
    act(() =>
      result.current.handlers.onDragStart({
        ...start,
        active: { ...start.active, id: "b" },
      }),
    );
    act(() => {
      result.current.collisionDetection(collision(0, "ungrouped"));
      result.current.handlers.onDragMove();
    });
    act(() =>
      result.current.handlers.onDragEnd({
        ...end,
        active: { id: "b" },
        over: {
          id: UNGROUPED_ID,
          data: { current: { type: "ungrouped" } },
        },
      } as unknown as DragEndEvent),
    );
    expect(commitLayout).toHaveBeenCalledWith(
      { g: [], [UNGROUPED_ID]: ["a", "b"] },
      expect.any(Array),
    );
    expect(result.current.previewGroup).toBeNull();
  });
});

it("does not reinterpret a stationary pointer as a group gap after the merge changes geometry", () => {
  const { result, commitLayout } = setup();
  act(() => {
    result.current.collisionDetection(collision());
    result.current.handlers.onDragMove();
  });
  act(() => vi.advanceTimersByTime(MERGE_DWELL_MS));
  const preview = result.current.previewGroup!;
  const args = {
    ...collision(-1),
    droppableContainers: [
      {
        id: "upper",
        data: { current: { type: "group" } },
        rect: { current: { top: 0, bottom: 40, left: -10, right: 100 } },
      },
      {
        id: preview.groupId,
        data: { current: { type: "group" } },
        rect: { current: { top: 60, bottom: 160, left: -10, right: 100 } },
      },
    ],
  } as unknown as Parameters<CollisionDetection>[0];
  act(() => {
    result.current.collisionDetection(args);
    result.current.handlers.onDragMove();
  });
  expect(result.current.gapPreview).toBeNull();
  act(() => result.current.handlers.onDragEnd(end));
  expect(commitLayout).toHaveBeenCalledWith(
    { [UNGROUPED_ID]: [], [preview.groupId]: ["a", "b"] },
    expect.any(Array),
  );
});

it("holds a confirmed order beyond a fixed timeout until data catches up", async () => {
  const { result } = setup();
  act(() => result.current.handlers.onDragCancel());
  await act(async () => {
    await result.current.commitHeldLayout({ [UNGROUPED_ID]: ["b", "a"] }, []);
  });
  act(() => vi.advanceTimersByTime(5000));
  expect(
    result.current.containers.find((c) => c.id === UNGROUPED_ID)?.providerIds,
  ).toEqual(["b", "a"]);
});
it.each([true, false])(
  "keeps the last member's landing geometry until both animation and data finish (data first: %s)",
  async (dataFirst) => {
    vi.useFakeTimers();
    const commitLayout = vi.fn().mockResolvedValue(true);
    const { result, rerender } = renderHook(
      ({ groups }: { groups: ProviderGroupDefinition[] }) =>
        useGroupDnd({
          primaryProviders: providers,
          groups,
          isGroupCollapsed: () => false,
          setGroupCollapsed: vi.fn(),
          commitLayout,
          onFlatDragEnd: vi.fn(),
        }),
      {
        initialProps: {
          groups: [{ id: "g", name: "Work", providerIds: ["b"] }],
        },
      },
    );
    act(() =>
      result.current.handlers.onDragStart({
        ...start,
        active: { ...start.active, id: "b" },
      }),
    );
    act(() => {
      result.current.collisionDetection(collision(0, "ungrouped"));
      result.current.handlers.onDragMove();
    });
    await act(async () =>
      result.current.handlers.onDragEnd({
        ...end,
        active: { id: "b" },
        over: { id: UNGROUPED_ID, data: { current: { type: "ungrouped" } } },
      } as unknown as DragEndEvent),
    );
    const hasEmptyGroup = () =>
      result.current.containers.some(
        (c) => c.id === "g" && c.providerIds.length === 0,
      );
    expect(hasEmptyGroup()).toBe(true);
    if (dataFirst) rerender({ groups: [] });
    else act(() => result.current.finishDropAnimation());
    expect(hasEmptyGroup()).toBe(true);
    if (dataFirst) act(() => result.current.finishDropAnimation());
    else rerender({ groups: [] });
    expect(result.current.containers.map((c) => c.id)).toEqual([UNGROUPED_ID]);
    expect(result.current.containers[0].providerIds).toEqual(["a", "b"]);
  },
);
it("releases a failed layout explicitly instead of waiting for a visual timeout", async () => {
  const { result, commitLayout } = setup();
  act(() => result.current.handlers.onDragCancel());
  commitLayout.mockResolvedValueOnce(false);
  await act(async () => {
    await result.current.commitHeldLayout({ [UNGROUPED_ID]: ["b", "a"] }, []);
  });
  expect(
    result.current.containers.find((c) => c.id === UNGROUPED_ID)?.providerIds,
  ).toEqual(["a", "b"]);
});
