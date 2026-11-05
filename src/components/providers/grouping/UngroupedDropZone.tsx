import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import { UNGROUPED_ID } from "@/lib/providerGroups";

/** 常驻尾部落点：布局空间不随拖动开关变化，边界随窗口及滚动容器更新。 */
export function UngroupedDropZone({
  active,
  movingOut,
  fillViewport,
}: {
  active: boolean;
  movingOut: boolean;
  fillViewport: boolean;
}) {
  const { t } = useTranslation();
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(64);
  const { setNodeRef } = useDroppable({
    id: UNGROUPED_ID,
    data: { type: "ungrouped" },
  });
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef],
  );

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    let frame = 0;
    const update = () => {
      let bottom = window.innerHeight;
      for (
        let parent = node.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        if (/(auto|scroll|hidden)/.test(getComputedStyle(parent).overflowY)) {
          bottom = Math.min(bottom, parent.getBoundingClientRect().bottom);
          break;
        }
      }
      setHeight(
        fillViewport
          ? Math.max(64, bottom - node.getBoundingClientRect().top - 24)
          : 64,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    const observer = new ResizeObserver(schedule);
    if (node.parentElement) observer.observe(node.parentElement);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [fillViewport]);

  return (
    <div
      ref={attach}
      data-provider-group="ungrouped"
      data-ungrouped-drop-zone
      style={{ height }}
      className="relative min-h-16"
    >
      <div
        aria-hidden={!active}
        className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-caption text-fg-3 transition-opacity duration-150 motion-reduce:transition-none"
        style={{ opacity: active ? 1 : 0 }}
      >
        {movingOut
          ? t("providerGroups.dropToUngrouped", {
              defaultValue: "松手移出分组",
            })
          : t("providerGroups.dropToEnd", { defaultValue: "松手移至末尾" })}
      </div>
    </div>
  );
}
