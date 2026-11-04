import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGroupMenuActions } from "@/components/providers/grouping/useGroupMenuActions";
import {
  resolveGroupedLayout,
  resolveProviderGroupingMode,
  UNGROUPED_ID,
} from "@/lib/providerGroups";
import type { Provider, ProviderGroupDefinition } from "@/types";
const providers: Provider[] = ["a", "b", "c"].map((id) => ({
  id,
  name: id,
  settingsConfig: {},
}));
const groups: ProviderGroupDefinition[] = [
  { id: "g", name: "Work", providerIds: ["a", "b"] },
];
function setup(definitions = groups, disabled = false) {
  const commit = vi.fn();
  const hook = renderHook(() =>
    useGroupMenuActions(
      resolveGroupedLayout(definitions, providers),
      commit,
      disabled,
    ),
  );
  return { ...hook, commit };
}
describe("grouping mode compatibility", () => {
  it("defaults to off and preserves the earlier drag experience", () => {
    expect(resolveProviderGroupingMode({})).toBe("off");
    expect(
      resolveProviderGroupingMode({ providerGroups: { claude: groups } }),
    ).toBe("drag");
    expect(
      resolveProviderGroupingMode({
        providerGroupingMode: "off",
        providerGroups: { claude: groups },
      }),
    ).toBe("off");
    expect(resolveProviderGroupingMode({ providerGroupingMode: "menu" })).toBe(
      "menu",
    );
  });
  it("assigns duplicate members and group identifiers only once", () => {
    const layout = resolveGroupedLayout(
      [
        ...groups,
        { id: "g2", name: "Other", providerIds: ["a", "c", "c"] },
        ...groups,
      ],
      providers,
    );
    expect(layout.containers.map((c) => c.providerIds)).toEqual([
      ["a", "b"],
      ["c"],
      [],
    ]);
  });
});
describe("desktop group actions", () => {
  it("creates the first group through an explicit name dialog", () => {
    const { result, commit } = setup([]);
    act(() =>
      result.current
        .buildGroupMenu("a")
        .actions!.find((a) => a.key === "create")!
        .onSelect(),
    );
    expect(result.current.creatingFor).toBe("a");
    act(() => result.current.create("  Work  "));
    const [pending, created] = commit.mock.calls[0];
    expect(created[0]).toMatchObject({ name: "Work", providerIds: ["a"] });
    expect(pending[created[0].id]).toEqual(["a"]);
    expect(pending[UNGROUPED_ID]).toEqual(["b", "c"]);
    expect(result.current.creatingFor).toBeNull();
  });
  it("cancel and blank names never save", () => {
    const { result, commit } = setup([]);
    act(() => result.current.setCreatingFor("a"));
    act(() => result.current.create("  "));
    act(() => result.current.setCreatingFor(null));
    expect(commit).not.toHaveBeenCalled();
  });
  it("moves between containers with one membership", () => {
    const { result, commit } = setup();
    act(() =>
      result.current
        .buildGroupMenu("c")
        .options.find((o) => o.key === "g")!
        .onSelect(),
    );
    expect(commit.mock.calls[0][0]).toEqual({
      g: ["a", "b", "c"],
      [UNGROUPED_ID]: [],
    });
  });
  it("moves a member out and reorders cards without pointer drag", () => {
    const { result, commit } = setup();
    act(() =>
      result.current
        .buildGroupMenu("a")
        .options.find((o) => o.key === UNGROUPED_ID)!
        .onSelect(),
    );
    expect(commit.mock.calls[0][0]).toEqual({
      g: ["b"],
      [UNGROUPED_ID]: ["c", "a"],
    });
    act(() =>
      result.current
        .buildGroupMenu("a")
        .actions!.find((a) => a.key === "down")!
        .onSelect(),
    );
    expect(commit.mock.calls[1][0].g).toEqual(["b", "a"]);
    expect(
      result.current.buildGroupMenu("a").actions!.find((a) => a.key === "up")!
        .disabled,
    ).toBe(true);
  });
  it("reorders and dissolves groups without deleting providers", () => {
    const { result, commit } = setup([
      ...groups,
      { id: "g2", name: "Other", providerIds: ["c"] },
    ]);
    act(() =>
      result.current
        .groupActions("g")
        .find((a) => a.key === "down")!
        .onSelect(),
    );
    expect(
      commit.mock.calls[0][1].map((g: ProviderGroupDefinition) => g.id),
    ).toEqual(["g2", "g"]);
    act(() =>
      result.current
        .groupActions("g")
        .find((a) => a.key === "dissolve")!
        .onSelect(),
    );
    expect(commit.mock.calls[1]).toEqual([
      { g2: ["c"], [UNGROUPED_ID]: ["a", "b"] },
      [{ id: "g2", name: "Other", providerIds: ["c"] }],
    ]);
  });
  it("blocks edits while a save is pending", () => {
    const { result, commit } = setup(groups, true);
    expect(
      result.current.buildGroupMenu("c").options.every((o) => o.disabled),
    ).toBe(true);
    act(() => result.current.buildGroupMenu("c").options[0].onSelect());
    expect(commit).not.toHaveBeenCalled();
  });
});
