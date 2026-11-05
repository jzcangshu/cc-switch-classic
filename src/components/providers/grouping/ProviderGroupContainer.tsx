import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppId } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { GroupPreviewIcons, type GroupMiniIcon } from "./GroupPreviewIcons";
export type { GroupMiniIcon } from "./GroupPreviewIcons";
import type { ProviderGroupDefinition } from "@/types";

interface ProviderGroupContainerProps {
  appId: AppId;
  group: ProviderGroupDefinition;
  isCollapsed: boolean;
  /** 拖影落位中：真组隐藏，等拖影末帧再现身（与卡片 settling 同语义） */
  isSettling?: boolean;
  dragEnabled?: boolean;
  dragDisabled?: boolean;
  renameDisabled?: boolean;
  actions?: ReactNode;
  onToggleCollapse: () => void;
  onRename: (name: string) => void;
  miniIcons: GroupMiniIcon[];
  children: ReactNode;
}

/**
 * 分组的「文件夹」容器：圆角底盒 + 可折叠头部 + 拖拽悬停高亮。
 * 头部是分组在分组排序里的拖拽把手（右端 grip）；点名字改名，点其余区域折叠。
 * 容器本体由父级 DndContext 注册为 droppable（卡片拖入目标）。
 */
export function ProviderGroupContainer({
  appId,
  group,
  isCollapsed,
  isSettling = false,
  dragEnabled = true,
  dragDisabled = false,
  renameDisabled = false,
  actions,
  onToggleCollapse,
  onRename,
  miniIcons,
  children,
}: ProviderGroupContainerProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: group.id,
    disabled: !dragEnabled || dragDisabled,
    data: { type: "group" },
    // 组容器位移保留 dnd-kit CSS 过渡（官方多容器同款），与卡片 spring 观感对齐
    transition: {
      duration: reducedMotion ? 0 : 240,
      easing: "cubic-bezier(0.2, 0.85, 0.25, 1)",
    },
  });

  // 折叠/展开走高度动画，与搜索面板同一套缓动语言
  const bodyId = `provider-group-body-${group.id}`;

  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(group.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      requestAnimationFrame(() => renameInputRef.current?.select());
    }
  }, [isRenaming]);

  const commitRename = () => {
    const next = draftName.trim();
    setIsRenaming(false);
    if (next && next !== group.name) {
      onRename(next);
    } else {
      setDraftName(group.name);
    }
  };

  return (
    <section
      ref={setNodeRef}
      data-provider-group={group.id}
      aria-expanded={!isCollapsed}
      style={{
        transform: transform
          ? `translate3d(0, ${transform.y}px, 0)`
          : undefined,
        transition,
        position: "relative",
        // 拖拽中本体降透明度（官方容器拖拽同款），可见体是 DragOverlay 拖影；
        // 拖影落位中保持隐藏，等末帧再由真组现身（零闪现）
        opacity: isSettling ? 0 : isDragging ? 0.4 : undefined,
      }}
      className="rounded-2xl border border-border/70 bg-black/[0.03] p-2.5 dark:bg-white/[0.04]"
    >
      <div
        className="flex min-w-0 cursor-pointer select-none flex-wrap items-center gap-2 rounded-md px-1 py-1"
        onClick={onToggleCollapse}
      >
        <button
          type="button"
          className="flex shrink-0 items-center p-0.5 text-fg-3"
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse();
          }}
          aria-controls={bodyId}
          aria-expanded={!isCollapsed}
          aria-label={t("providerGroups.toggleAriaLabel", {
            name: group.name,
            defaultValue: "折叠或展开分组",
          })}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {isRenaming ? (
          <Input
            ref={renameInputRef}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename();
              if (event.key === "Escape") {
                setDraftName(group.name);
                setIsRenaming(false);
              }
            }}
            onClick={(event) => event.stopPropagation()}
            className="h-7 max-w-56 py-0 text-sm font-semibold"
            aria-label={t("providerGroups.renameAriaLabel", {
              defaultValue: "分组名称",
            })}
          />
        ) : (
          <button
            type="button"
            className="min-w-0 max-w-56 shrink truncate text-sm font-semibold text-fg-1"
            onClick={(event) => {
              event.stopPropagation();
              setDraftName(group.name);
              setIsRenaming(true);
            }}
            disabled={renameDisabled}
            title={group.name}
            aria-label={t("providerGroups.renameAriaLabel", {
              defaultValue: "分组名称",
            })}
          >
            {group.name}
          </button>
        )}
        {isCollapsed && miniIcons.length > 0 && (
          <GroupPreviewIcons appId={appId} items={miniIcons} />
        )}
        <span className="shrink-0 text-sm text-fg-3">
          {group.providerIds.length}
        </span>
        <div
          className="ml-auto flex shrink-0 items-center gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          {actions}
          {dragEnabled && (
            <button
              ref={setActivatorNodeRef}
              type="button"
              className="ml-auto flex shrink-0 cursor-grab items-center justify-center p-1 text-muted-foreground/50 transition-colors hover:text-muted-foreground active:cursor-grabbing"
              aria-label={t("providerGroups.dragGroupHandle", {
                defaultValue: "拖动调整分组顺序",
              })}
              onClick={(event) => event.stopPropagation()}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            id={bodyId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
