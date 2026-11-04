import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { AppId } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { ProviderIcon } from "@/components/ProviderIcon";
import { resolveProviderIcon } from "@/utils/providerIcon";
import type { ProviderGroupDefinition } from "@/types";

/** 分组成员的迷你图标信息（折叠态头部展示，iOS 文件夹质感） */
export interface GroupMiniIcon {
  id: string;
  name: string;
  icon?: string;
  iconColor?: string;
}

interface ProviderGroupContainerProps {
  appId: AppId;
  group: ProviderGroupDefinition;
  /** 拖拽中的卡片已进入本容器（由父级从拖拽内存态推导，悬停组内卡片时也算） */
  isDragOver: boolean;
  isCollapsed: boolean;
  /** 本次拖拽中新建的分组：挂载即播新生光晕，随后常驻为透明层 */
  isNewborn?: boolean;
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
  isDragOver,
  isCollapsed,
  isNewborn = false,
  onToggleCollapse,
  onRename,
  miniIcons,
  children,
}: ProviderGroupContainerProps) {
  const { t } = useTranslation();
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
    data: { type: "group" },
    // 组容器位移保留 dnd-kit CSS 过渡（官方多容器同款），与卡片 spring 观感对齐
    transition: { duration: 300, easing: "cubic-bezier(0.2, 0.85, 0.25, 1)" },
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
        // 拖拽中本体降透明度（官方容器拖拽同款），可见体是 DragOverlay 拖影
        opacity: isDragging ? 0.4 : undefined,
      }}
      className={cn(
        "rounded-2xl border border-border/70 bg-black/[0.03] p-2.5 transition-all duration-150 dark:bg-white/[0.04]",
        isDragOver &&
          "border-primary/60 bg-primary/[0.06] ring-1 ring-primary/40",
        isDragging && "border-primary/50",
      )}
    >
      {/* 新生光晕：仅新建分组首次挂载时从 1 渐隐到 0，此后常驻透明层（无 pop） */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-primary/50"
        initial={{ opacity: isNewborn ? 1 : 0 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
      />
      <div
        className="flex cursor-pointer select-none items-center gap-1.5 rounded-md px-1 py-1"
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
            className="min-w-0 max-w-56 truncate text-sm font-semibold text-fg-1"
            onClick={(event) => {
              event.stopPropagation();
              setDraftName(group.name);
              setIsRenaming(true);
            }}
            title={group.name}
            aria-label={t("providerGroups.renameAriaLabel", {
              defaultValue: "分组名称",
            })}
          >
            {group.name}
          </button>
        )}
        {isCollapsed && miniIcons.length > 0 && (
          <span className="flex shrink-0 items-center -space-x-1.5">
            {miniIcons.slice(0, 4).map((item) => (
              <span
                key={item.id}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-surface"
                title={item.name}
              >
                <ProviderIcon
                  icon={resolveProviderIcon(appId, item.icon, item.iconColor)}
                  name={item.name}
                  color={item.iconColor}
                  size={14}
                />
              </span>
            ))}
          </span>
        )}
        <span className="shrink-0 text-sm text-fg-3">
          {group.providerIds.length}
        </span>
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
      </div>
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            id={bodyId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
