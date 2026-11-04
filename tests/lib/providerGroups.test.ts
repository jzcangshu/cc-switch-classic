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
  previewGroupSlotIndex,
  pruneEmptyGroups,
  renameGroup,
  resolveGroupedLayout,
  reorderGroups,
  resolveHoverBand,
  UNGROUPED_ID,
  type PendingLayout,
} from "@/lib/providerGroups";
import {
  dissolveDragCreatedGroups,
  mergeIntoNewGroup,
  pendingLayoutToContainers,
  planInsert,
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

describe("resolveHoverBand（iOS 两级触发波段）", () => {
  const rect = { top: 100, height: 100 };
  // edgeRatio=0.18, exactRatio=0.1 → [18,40)=near [40,60]=exact (60,82]=near

  it("上边缘带 → before（挪位）", () => {
    expect(resolveHoverBand(105, rect, 0.18, 0.1)).toBe("before");
    expect(resolveHoverBand(117, rect, 0.18, 0.1)).toBe("before");
  });

  it("下边缘带 → after（挪位）", () => {
    expect(resolveHoverBand(183, rect, 0.18, 0.1)).toBe("after");
    expect(resolveHoverBand(195, rect, 0.18, 0.1)).toBe("after");
  });

  it("模糊重叠带 → near（认领板预备 + 超久才建组）", () => {
    expect(resolveHoverBand(125, rect, 0.18, 0.1)).toBe("near");
    expect(resolveHoverBand(175, rect, 0.18, 0.1)).toBe("near");
  });

  it("精确重叠带 → exact（卡片正中，快速建组）", () => {
    expect(resolveHoverBand(150, rect, 0.18, 0.1)).toBe("exact");
    expect(resolveHoverBand(141, rect, 0.18, 0.1)).toBe("exact");
    expect(resolveHoverBand(159, rect, 0.18, 0.1)).toBe("exact");
  });

  it("指针缺失（键盘拖拽）或矩形缺失 → null", () => {
    expect(resolveHoverBand(null, rect)).toBeNull();
    expect(resolveHoverBand(150, null)).toBeNull();
    expect(resolveHoverBand(150, { top: 0, height: 0 })).toBeNull();
  });
});

describe("planInsert", () => {
  const base = (): PendingLayout => ({
    [UNGROUPED_ID]: ["a", "b", "c"],
    g1: ["x", "y"],
  });

  it("跨容器：落到 anchor 之前", () => {
    const { next, changed } = planInsert(base(), "a", "g1", "y", "before");
    expect(changed).toBe(true);
    expect(next.g1).toEqual(["x", "a", "y"]);
    expect(next[UNGROUPED_ID]).toEqual(["b", "c"]);
  });

  it("跨容器：落到 anchor 之后", () => {
    const { next } = planInsert(base(), "a", "g1", "y", "after");
    expect(next.g1).toEqual(["x", "y", "a"]);
  });

  it("anchor 为 null：追加末尾", () => {
    const { next } = planInsert(base(), "a", "g1", null, "after");
    expect(next.g1).toEqual(["x", "y", "a"]);
  });

  it("同容器 no-op：changed=false 且返回原引用", () => {
    const pending = base();
    const { next, changed } = planInsert(
      pending,
      "a",
      UNGROUPED_ID,
      "b",
      "before",
    );
    expect(changed).toBe(false);
    expect(next).toBe(pending);
  });

  it("同容器向下拖：落 anchor 之后（官方 arrayMove 语义）", () => {
    const { next, changed } = planInsert(
      base(),
      "a",
      UNGROUPED_ID,
      "c",
      "after",
    );
    expect(changed).toBe(true);
    expect(next[UNGROUPED_ID]).toEqual(["b", "c", "a"]);
  });

  it("目标容器不存在：原样返回", () => {
    const pending = base();
    const { changed } = planInsert(pending, "a", "nope", null, "after");
    expect(changed).toBe(false);
  });
});

describe("mergeIntoNewGroup", () => {
  const base = () => ({
    groups: [group("g1", "常用", ["x"])],
    pending: {
      g1: ["x"],
      [UNGROUPED_ID]: ["a", "b", "c"],
    } as PendingLayout,
  });

  it("新建组排末尾，A 在前，两卡从未分组摘除", () => {
    const { groups, pending, newGroupId } = mergeIntoNewGroup(
      base().groups,
      base().pending,
      "a",
      "b",
      "新建分组",
    )!;
    expect(groups.map((g) => g.id)).toEqual(["g1", newGroupId]);
    expect(groups[1]).toMatchObject({
      name: "新建分组",
      providerIds: ["a", "b"],
    });
    expect(pending[newGroupId]).toEqual(["a", "b"]);
    expect(pending[UNGROUPED_ID]).toEqual(["c"]);
    expect(pending.g1).toEqual(["x"]);
  });

  it("不修改输入（快照不变性）", () => {
    const snapshot = base();
    mergeIntoNewGroup(snapshot.groups, snapshot.pending, "a", "b", "n");
    expect(snapshot.pending[UNGROUPED_ID]).toEqual(["a", "b", "c"]);
    expect(snapshot.groups).toHaveLength(1);
  });

  it("前置条件不满足：anchor 不在未分组 → null", () => {
    const pending = { [UNGROUPED_ID]: ["a"], g1: ["x"] } as PendingLayout;
    expect(mergeIntoNewGroup([], pending, "a", "x", "n")).toBeNull();
  });

  it("同一张卡 → null", () => {
    const pending = { [UNGROUPED_ID]: ["a"] } as PendingLayout;
    expect(mergeIntoNewGroup([], pending, "a", "a", "n")).toBeNull();
  });
});

describe("dissolveDragCreatedGroups", () => {
  it("成员按原序退回未分组头部，组被移除", () => {
    const pending: PendingLayout = {
      [UNGROUPED_ID]: ["c", "d"],
      newGrp: ["a", "b"],
    };
    const groups = [group("newGrp", "新建分组", ["a", "b"])];
    const result = dissolveDragCreatedGroups(groups, pending, ["newGrp"]);
    expect(result.groups).toHaveLength(0);
    expect(result.pending[UNGROUPED_ID]).toEqual(["a", "b", "c", "d"]);
    expect(result.pending.newGrp).toBeUndefined();
  });

  it("组不在 pending 中：静默跳过", () => {
    const pending: PendingLayout = { [UNGROUPED_ID]: ["a"] };
    const result = dissolveDragCreatedGroups([], pending, ["ghost"]);
    expect(result.pending).toEqual(pending);
  });
});

describe("pendingLayoutToContainers", () => {
  it("以 pending 成员顺序为准，过滤不存在的供应商", () => {
    const containers = pendingLayoutToContainers(
      [group("g1", "常用", ["x", "ghost"])],
      { g1: ["x", "ghost", "y"], [UNGROUPED_ID]: ["a"] },
      [provider("x"), provider("y"), provider("a")],
    );
    expect(containers[0]).toMatchObject({ id: "g1", providerIds: ["x", "y"] });
    expect(containers[1]).toMatchObject({
      id: UNGROUPED_ID,
      providerIds: ["a"],
    });
  });
});

describe("previewGroupSlotIndex", () => {
  it("拖拽卡在锚点之前：只统计移除后仍留下的卡，预览组插在 D 之前", () => {
    const pending: PendingLayout = {
      [UNGROUPED_ID]: ["a", "b", "c", "d", "e"],
    };
    // 移除 b（拖拽卡）与 d（锚点）后：[a, c, e]，预览组应插在 e 之前 → 2
    expect(previewGroupSlotIndex(pending, "b", "d")).toBe(2);
  });

  it("拖拽卡在锚点之后：锚点原位置不受影响", () => {
    const pending: PendingLayout = {
      [UNGROUPED_ID]: ["a", "c", "d", "b"],
    };
    // 移除 b/c 后：[a, d]，预览组插在 d 之前 → 1
    expect(previewGroupSlotIndex(pending, "b", "c")).toBe(1);
  });

  it("锚点不在未分组：回退到 0", () => {
    expect(previewGroupSlotIndex({ [UNGROUPED_ID]: ["a"] }, "b", "ghost")).toBe(
      0,
    );
  });
});

describe("temporarily hidden providers", () => {
  it("keeps saved members outside the primary view while removing deleted ids", () => {
    const result = pendingToGroups(
      [group("g", "Work", ["a", "hidden", "deleted"])],
      { g: [], [UNGROUPED_ID]: ["a"] },
      new Set(["a"]),
      new Set(["a", "hidden"]),
    );
    expect(result).toEqual([group("g", "Work", ["hidden"])]);
  });
});
