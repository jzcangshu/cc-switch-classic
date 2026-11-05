import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UngroupedDropZone } from "@/components/providers/grouping/UngroupedDropZone";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("bottom drop area", () => {
  it("keeps its space when dragging ends and follows the window bottom with a margin", () => {
    vi.useFakeTimers();
    let top = 300;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => ({ top, bottom: 0 }) as DOMRect,
    );
    const view = render(<UngroupedDropZone active movingOut fillViewport />);
    const zone = view.container.firstElementChild as HTMLElement;
    expect(parseFloat(zone.style.height)).toBe(window.innerHeight - 300 - 24);
    view.rerender(<UngroupedDropZone active={false} movingOut fillViewport />);
    expect(view.container.firstElementChild).toBe(zone);
    expect(parseFloat(zone.style.height)).toBe(window.innerHeight - 300 - 24);
    top = 200;
    act(() => {
      window.dispatchEvent(new Event("resize"));
      vi.advanceTimersByTime(20);
    });
    expect(parseFloat(zone.style.height)).toBe(window.innerHeight - 200 - 24);
  });
  it("stops at the scrolling pane bottom and does not push following sections to the next screen", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return { top: 300, bottom: this.dataset.pane ? 600 : 0 } as DOMRect;
      },
    );
    const view = render(
      <div data-pane="true" style={{ overflowY: "auto" }}>
        <UngroupedDropZone active movingOut fillViewport />
      </div>,
    );
    const zone = view.container.querySelector(
      "[data-ungrouped-drop-zone]",
    ) as HTMLElement;
    expect(parseFloat(zone.style.height)).toBe(276);
    view.rerender(
      <div data-pane="true" style={{ overflowY: "auto" }}>
        <UngroupedDropZone active movingOut fillViewport={false} />
      </div>,
    );
    expect(parseFloat(zone.style.height)).toBe(64);
  });
});
