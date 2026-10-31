import { describe, it, expect } from "vitest";
import type { Provider, ProviderGroupDefinition } from "@/types";
import {
  buildSortIndexUpdates,
  createGroupWithProviders,
  getGroupsForApp,
  isGroupingActive,
  layoutToPending,
  moveProviderInPending,
  pendingToGroups,
  pruneEmptyGroups,
  renameGroup,
  resolveGroupedLayout,
  reorderGroups,
  UNGROUPED_ID,
} from "@/lib/providerGroups";

function provider(id: string): Provider {
  return { id, name: id, settingsConfig: {} };
}

function group(
  id: string,
  name: string,
  providerIds: string[],
): ProviderGroupDefinition {
  return { id, name, providerIds };
}

describe("getGroupsForApp / isGroupingActive", () => {
  it("returns empty for missing app bucket and inactive when no groups", () => {
    expect(getGroupsForApp(null, "claude")).toEqual([]);
    expect(getGroupsForApp({ claude: [] }, "claude")).toEqual([]);
    expect(isGroupingActive([])).toBe(false);
    expect(isGroupingActive([group("g1", "常用", ["a"])])).toBe(true);
  });
});

describe("resolveGroupedLayout", () => {
  it("partitions items into groups then ungrouped, tolerating stale ids", () => {
    const groups = [
      group("g1", "常用", ["a", "ghost"]),
      group("g2", "备用", ["c"]),
    ];
    const layout = resolveGroupedLayout(groups, [
      provider("a"),
      provider("b"),
      provider("c"),
    ]);
    expect(layout.containers.map((c) => c.id)).toEqual([
      "g1",
      "g2",
      UNGROUPED_ID,
    ]);
    expect(layout.containers[0].providerIds).toEqual(["a"]);
    expect(layout.containers[2].providerIds).toEqual(["b"]);
    expect(layout.containerOf).toEqual({ a: "g1", c: "g2", b: UNGROUPED_ID });
  });

  it("keeps group definitions whose members are all gone (may come back)", () => {
    const layout = resolveGroupedLayout(
      [group("g1", "常用", ["ghost"])],
      [provider("a")],
    );
    expect(layout.containers[0].providerIds).toEqual([]);
    expect(layout.containers[1].providerIds).toEqual(["a"]);
  });
});

describe("moveProviderInPending", () => {
  const base = () => ({
    g1: ["a", "b"],
    [UNGROUPED_ID]: ["c", "d"],
  });

  it("moves between containers appending by default", () => {
    const next = moveProviderInPending(base(), "a", UNGROUPED_ID, null);
    expect(next[UNGROUPED_ID]).toEqual(["c", "d", "a"]);
    expect(next.g1).toEqual(["b"]);
  });

  it("inserts before the given member", () => {
    const next = moveProviderInPending(base(), "a", UNGROUPED_ID, "d");
    expect(next[UNGROUPED_ID]).toEqual(["c", "a", "d"]);
  });

  it("reorders within the same container", () => {
    const next = moveProviderInPending(base(), "a", "g1", "b");
    expect(next.g1).toEqual(["b", "a"]);
  });

  it("is a no-op when the target container does not exist", () => {
    const pending = base();
    expect(moveProviderInPending(pending, "a", "missing", null)).toBe(pending);
  });
});

describe("createGroupWithProviders / renameGroup / reorderGroups", () => {
  it("appends a new group with both members", () => {
    const groups = [group("g1", "常用", ["a"])];
    const next = createGroupWithProviders(groups, ["b", "c"], "新建分组");
    expect(next).toHaveLength(2);
    expect(next[1].name).toBe("新建分组");
    expect(next[1].providerIds).toEqual(["b", "c"]);
    expect(next[1].id).not.toBe("g1");
  });

  it("renames only the target group", () => {
    const groups = [group("g1", "常用", ["a"]), group("g2", "备用", ["b"])];
    const next = renameGroup(groups, "g2", "冷备");
    expect(next[1].name).toBe("冷备");
    expect(next[0].name).toBe("常用");
  });

  it("reorders groups", () => {
    const groups = [
      group("g1", "一", []),
      group("g2", "二", []),
      group("g3", "三", []),
    ];
    expect(reorderGroups(groups, "g3", "g1").map((g) => g.id)).toEqual([
      "g3",
      "g1",
      "g2",
    ]);
    expect(reorderGroups(groups, "g1", "g1")).toBe(groups);
    expect(reorderGroups(groups, "x", "g1")).toBe(groups);
  });
});

describe("pruneEmptyGroups / pendingToGroups", () => {
  const valid = new Set(["a", "b", "c"]);

  it("drops groups without any valid member", () => {
    const groups = [group("g1", "常用", ["ghost"]), group("g2", "备用", ["a"])];
    expect(pruneEmptyGroups(groups, valid).map((g) => g.id)).toEqual(["g2"]);
  });

  it("maps pending order onto definitions and prunes emptied groups", () => {
    const groups = [
      group("g1", "常用", ["a", "b"]),
      group("g2", "备用", ["c"]),
    ];
    const pending = { g1: ["b", "a"], g2: [], [UNGROUPED_ID]: ["c"] };
    const next = pendingToGroups(groups, pending, valid);
    expect(next.map((g) => g.id)).toEqual(["g1"]);
    expect(next[0].providerIds).toEqual(["b", "a"]);
  });
});

describe("buildSortIndexUpdates", () => {
  it("orders groups first, then ungrouped, then non-primary preserving relative order", () => {
    const containers = resolveGroupedLayout(
      [group("g1", "常用", ["b"])],
      [provider("a"), provider("b"), provider("c")],
    ).containers;
    const flat = [
      provider("a"),
      provider("b"),
      provider("c"),
      provider("z1"),
      provider("z2"),
    ];
    const primaryIds = new Set(["a", "b", "c"]);
    const updates = buildSortIndexUpdates(containers, primaryIds, flat);
    expect(updates.map((u) => u.id)).toEqual(["b", "a", "c", "z1", "z2"]);
    expect(updates.map((u) => u.sortIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it("keeps every provider exactly once", () => {
    const items = Array.from({ length: 5 }, (_, i) => provider(`p${i}`));
    const containers = resolveGroupedLayout(
      [group("g1", "常用", ["p1", "p0"])],
      items,
    ).containers;
    const updates = buildSortIndexUpdates(
      containers,
      new Set(items.map((p) => p.id)),
      items,
    );
    expect(new Set(updates.map((u) => u.id)).size).toBe(items.length);
  });

  it("layoutToPending round-trips through resolveGroupedLayout", () => {
    const items = [provider("a"), provider("b"), provider("c")];
    const groups = [group("g1", "常用", ["c"])];
    const layout = resolveGroupedLayout(groups, items);
    const pending = layoutToPending(layout);
    expect(pending[UNGROUPED_ID]).toEqual(["a", "b"]);
    const mapped = pendingToGroups(groups, pending, new Set(["a", "b", "c"]));
    expect(mapped[0].providerIds).toEqual(["c"]);
  });
});
