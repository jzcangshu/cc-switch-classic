import { HelpTip } from "@/components/ui/help-tip";
import type { ProviderSection } from "./presentation";

/** 平铺和两种分组视图共用分区名称与业务说明。 */
export function ProviderSectionTitle({
  section,
}: {
  section: ProviderSection;
}) {
  if (!section.title) return null;
  return (
    <div className="flex items-center gap-1 text-caption font-semibold text-fg-2">
      <h2 className="m-0 text-caption font-semibold">{section.title}</h2>
      {section.help && (
        <HelpTip title={section.help.title}>{section.help.body}</HelpTip>
      )}
    </div>
  );
}
