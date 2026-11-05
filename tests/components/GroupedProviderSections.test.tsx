import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  GroupedProviderSections,
  type GroupedProviderSectionsProps,
} from "@/components/providers/grouping/GroupedProviderSections";
import { UNGROUPED_ID } from "@/lib/providerGroups";

const drag = vi.hoisted(() => ({ preview: true }));
const group = { id: "g", name: "Work", providerIds: ["a"] };
vi.mock("@/components/providers/grouping/useGroupLayoutCommit", () => ({
  useGroupLayoutCommit: () => ({ commitLayout: vi.fn(), isSaving: false }),
}));
vi.mock("@/components/providers/grouping/useGroupMenuActions", () => ({
  useGroupMenuActions: () => ({ groupActions: () => [] }),
}));
vi.mock("@/components/providers/grouping/useGroupDnd", () => ({
  useGroupDnd: () => ({
    containers: [
      { id: "g", group, providerIds: ["a"] },
      { id: UNGROUPED_ID, group: null, providerIds: ["b"] },
    ],
    containerOf: { a: "g", b: UNGROUPED_ID },
    handlers: {},
    previewGroup: drag.preview
      ? { groupId: "g", slotIndex: 1, anchorId: "a" }
      : null,
    finishDropAnimation: vi.fn(),
  }),
}));

describe("group promotion", () => {
  it("moves the existing group and its contents instead of mounting a second group", () => {
    drag.preview = true;
    const providers = ["a", "b"].map((id) => ({
      id,
      name: id,
      settingsConfig: {},
    }));
    const props = {
      appId: "claude",
      primaryKey: "all",
      sortedProviders: providers,
      sections: [
        {
          key: "all",
          items: providers.map((provider) => ({
            provider,
            presentation: { buttons: [], chips: [] },
          })),
        },
      ],
      providerGroups: {
        groups: [group],
        isGroupCollapsed: () => false,
        setGroupCollapsed: vi.fn(),
        saveAppGroups: vi.fn(),
      },
      renderCard: (provider: { id: string }) => (
        <input aria-label={provider.id} defaultValue={provider.id} />
      ),
      renderPlainCard: () => null,
      onFlatDragEnd: vi.fn(),
    } as unknown as GroupedProviderSectionsProps;
    const view = render(<GroupedProviderSections {...props} />);
    const node = view.container.querySelector('[data-provider-group="g"]');
    const card = screen.getByLabelText("a");
    card.focus();
    expect(
      view.container.querySelector('[data-group-preview="g"]'),
    ).not.toBeNull();
    drag.preview = false;
    view.rerender(<GroupedProviderSections {...props} />);
    expect(view.container.querySelector('[data-provider-group="g"]')).toBe(
      node,
    );
    expect(screen.getByLabelText("a")).toBe(card);
    expect(card).toHaveFocus();
    expect(view.container.querySelector("[data-group-preview]")).toBeNull();
    expect(
      screen.getAllByRole("textbox").map((el) => el.getAttribute("aria-label")),
    ).toEqual(["a", "b"]);
  });
});
