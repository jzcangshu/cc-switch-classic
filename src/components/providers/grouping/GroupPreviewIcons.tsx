import type { AppId } from "@/lib/api";
import { ProviderIcon } from "@/components/ProviderIcon";
import { resolveProviderIcon } from "@/utils/providerIcon";

export interface GroupMiniIcon {
  id: string;
  name: string;
  icon?: string;
  iconColor?: string;
}

/** 每个缩略图独立占位，文字回退和自定义图标都限制在格内。 */
export function GroupPreviewIcons({
  appId,
  items,
}: {
  appId: AppId;
  items: GroupMiniIcon[];
}) {
  return (
    <span
      data-group-preview-icons
      className="flex shrink-0 items-center gap-1 overflow-hidden"
    >
      {items.slice(0, 4).map((item) => (
        <span
          key={item.id}
          title={item.name}
          className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface"
        >
          <ProviderIcon
            icon={resolveProviderIcon(appId, item.icon, item.iconColor)}
            name={item.name}
            color={item.iconColor}
            size={18}
            className="overflow-hidden [&_svg]:h-full [&_svg]:w-full"
          />
        </span>
      ))}
    </span>
  );
}
