import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CollisionDetection, DragStartEvent } from "@dnd-kit/core";
import type { ProviderGroupDefinition } from "@/types";
import { UNGROUPED_ID } from "@/lib/providerGroups";
import {
  useGroupDnd,
  HOVER_INSERT_MS,
  MERGE_DWELL_MS,
  EXPAND_DWELL_MS,
} from "@/components/providers/grouping/useGroupDnd";

function rect(top: number, height = 84) {
  return { top, bottom: top + height, left: 0, right: 600, width: 600, height };
}
type Target = { id: string; top: number; type?: "group"; height?: number };
const cards: Target[] = [
  { id: "a", top: 0 },
  { id: "b", top: 100 },
  { id: "c", top: 200 },
];
function setup({
  activeId = "a",
  groups = [],
  targets = cards,
  collapsed = false,
}: {
  activeId?: string;
  groups?: ProviderGroupDefinition[];
  targets?: Target[];
  collapsed?: boolean;
} = {}) {
  vi.useFakeTimers();
  const setGroupCollapsed = vi.fn();
  const { result } = renderHook(() =>
    useGroupDnd({
      primaryProviders: ["a", "b", "c", "d"].map((id) => ({
        id,
        name: id,
        settingsConfig: {},
      })),
      groups,
      isGroupCollapsed: () => collapsed,
      setGroupCollapsed,
      commitLayout: vi.fn().mockResolvedValue(true),
      onFlatDragEnd: vi.fn(),
    }),
  );
  act(() =>
    result.current.handlers.onDragStart({
      active: {
        id: activeId,
        data: { current: { type: "card" } },
        rect: { current: { initial: rect(0) } },
      },
    } as unknown as DragStartEvent),
  );
  const hover = (y: number, x = 200) => {
    const measured = targets.map((t) => ({
      ...t,
      rect: rect(t.top, t.height),
    }));
    const args = {
      // 故意与指针相隔较远，验证缝隙按指针判定，不按拖影中心选另一张卡。
      collisionRect: rect(0),
      pointerCoordinates: { x, y },
      droppableRects: new Map(measured.map((t) => [t.id, t.rect])),
      droppableContainers: measured.map((t) => ({
        id: t.id,
        data: { current: { type: t.type ?? "card" } },
        rect: { current: t.rect },
      })),
    } as unknown as Parameters<CollisionDetection>[0];
    act(() => {
      result.current.collisionDetection(args);
      result.current.handlers.onDragMove();
    });
  };
  const order = (container = UNGROUPED_ID) =>
    result.current.containers.find((c) => c.id === container)?.providerIds;
  return { result, hover, order, setGroupCollapsed };
}
afterEach(() => vi.useRealTimers());

describe("pointer insertion targets", () => {
  it("recognizes the full whitespace between ungrouped cards after the usual dwell", () => {
    const { result, hover, order } = setup();
    hover(192);
    act(() => vi.advanceTimersByTime(HOVER_INSERT_MS - 1));
    expect(order()).toEqual(["a", "b", "c", "d"]);
    act(() => vi.advanceTimersByTime(1));
    expect(order()).toEqual(["b", "a", "c", "d"]);
    expect(result.current.mergeTargetId).toBeNull();
    expect(result.current.previewGroup).toBeNull();
  });

  it.each([
    { activeId: "c", y: 125, expected: ["a", "c", "b", "d"] },
    { activeId: "a", y: 159, expected: ["b", "a", "c", "d"] },
  ])(
    "uses the wider card edge for insertion at $y",
    ({ activeId, y, expected }) => {
      const { result, hover, order } = setup({ activeId });
      hover(y);
      expect(result.current.mergeTargetId).toBeNull();
      act(() => vi.advanceTimersByTime(HOVER_INSERT_MS));
      expect(order()).toEqual(expected);
      expect(result.current.previewGroup).toBeNull();
    },
  );

  it("keeps the center as a grouping target with immediate feedback and the existing dwell", () => {
    const { result, hover } = setup();
    hover(142);
    expect(result.current.mergeTargetId).toBe("b");
    act(() => vi.advanceTimersByTime(MERGE_DWELL_MS - 1));
    expect(result.current.previewGroup).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.previewGroup).not.toBeNull();
  });

  it("selects the pointed group slot even when the drag preview center is elsewhere", () => {
    const { hover, order } = setup({
      groups: [{ id: "g", name: "Work", providerIds: ["b", "c", "d"] }],
      targets: [
        ...cards,
        { id: "d", top: 300 },
        { id: "g", top: 90, height: 304, type: "group" },
      ],
    });
    hover(292);
    act(() => vi.advanceTimersByTime(HOVER_INSERT_MS));
    expect(order("g")).toEqual(["b", "c", "a", "d"]);
  });

  it("does not bridge different containers or horizontal space outside the cards", () => {
    const { hover, order } = setup({
      groups: [{ id: "g", name: "Work", providerIds: ["b"] }],
    });
    hover(192);
    act(() => vi.advanceTimersByTime(2000));
    expect(order()).toEqual(["a", "c", "d"]);
    hover(192, -10);
    act(() => vi.advanceTimersByTime(2000));
    expect(order("g")).toEqual(["b"]);
    expect(order()).toEqual(["a", "c", "d"]);
  });

  it("preserves a collapsed group between ungrouped cards as its own target", () => {
    const { hover, setGroupCollapsed, order } = setup({
      groups: [{ id: "g", name: "Work", providerIds: ["b"] }],
      targets: [
        { id: "a", top: 0 },
        { id: "c", top: 200 },
        { id: "g", top: 100, height: 84, type: "group" },
      ],
      collapsed: true,
    });
    hover(142);
    act(() => vi.advanceTimersByTime(EXPAND_DWELL_MS));
    expect(setGroupCollapsed).toHaveBeenCalledWith("g", false);
    expect(order()).toEqual(["a", "c", "d"]);
  });

  it.each([185, 210, 239])(
    "treats the whole ungrouped heading and surrounding whitespace as prepend at %i",
    (y) => {
      const { result, hover, order } = setup({
        groups: [{ id: "g", name: "Work", providerIds: ["a"] }],
        targets: [
          { id: "g", top: 0, height: 184, type: "group" },
          { id: "a", top: 100 },
          { id: "b", top: 240 },
          { id: "c", top: 340 },
        ],
      });
      hover(y);
      act(() => vi.advanceTimersByTime(HOVER_INSERT_MS));
      expect(order()).toEqual(["a", "b", "c", "d"]);
      expect(order("g")).toEqual([]);
      expect(result.current.mergeTargetId).toBeNull();
    },
  );

  it("prepends an existing ungrouped card without creating a group", () => {
    const { result, hover, order } = setup({
      activeId: "c",
      groups: [{ id: "g", name: "Work", providerIds: ["a"] }],
      targets: [
        { id: "g", top: 0, height: 184, type: "group" },
        { id: "a", top: 100 },
        { id: "b", top: 240 },
        { id: "c", top: 340 },
      ],
    });
    hover(210);
    act(() => vi.advanceTimersByTime(HOVER_INSERT_MS));
    expect(order()).toEqual(["c", "b", "d"]);
    expect(result.current.previewGroup).toBeNull();
    expect(order("g")).toEqual(["a"]);
  });

  it("keeps an actual group-body hit inside the group above the prepend zone", () => {
    const { hover, order } = setup({
      activeId: "c",
      groups: [{ id: "g", name: "Work", providerIds: ["a"] }],
      targets: [
        { id: "g", top: 0, height: 184, type: "group" },
        { id: "a", top: 100 },
        { id: "b", top: 240 },
        { id: "c", top: 340 },
      ],
    });
    hover(165);
    act(() => vi.advanceTimersByTime(HOVER_INSERT_MS));
    expect(order("g")).toEqual(["a", "c"]);
    expect(order()).toEqual(["b", "d"]);
  });
});
