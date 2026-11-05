import { ChevronDown } from "lucide-react";
import type { ProviderGroupDefinition } from "@/types";
import { GroupPreviewIcons } from "./GroupPreviewIcons";
import type { AppId } from "@/lib/api";
import type { GroupMiniIcon } from "./ProviderGroupContainer";

/**
 * 分组拖影（DragOverlay 内容）：紧凑分组头克隆，近似 iOS 拖动折叠文件夹的样子。
 * 原容器在拖拽中降为半透明，可见体只有这个 ghost。
 */
export function GroupDragGhost({
  appId,
  group,
  miniIcons,
  width,
}: {
  appId: AppId;
  group: ProviderGroupDefinition;
  miniIcons: GroupMiniIcon[];
  width?: number;
}) {
  return (
    <div
      style={{ width }}
      className=" rounded-2xl border border-border/70 bg-surface/95 p-2.5 shadow-2xl"
    >
      <div className="flex items-center gap-1.5 px-1 py-1">
        <ChevronDown className="h-4 w-4 shrink-0 text-fg-3" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg-1">
          {group.name}
        </span>
        <GroupPreviewIcons appId={appId} items={miniIcons} />
        <span className="shrink-0 text-sm text-fg-3">
          {group.providerIds.length}
        </span>
      </div>
    </div>
  );
}
