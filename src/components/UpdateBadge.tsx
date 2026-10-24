import { useUpdate } from "@/contexts/UpdateContext";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ArrowUpCircle } from "lucide-react";

interface UpdateBadgeProps {
  className?: string;
  onClick?: () => void;
}

/**
 * 独立的「有新版本」按钮（第三版形态）：有更新时出现在设置齿轮旁，
 * 点开进设置 → 关于。没有更新就不渲染，替代第四版齿轮上的绿点。
 */
export function UpdateBadge({ className = "", onClick }: UpdateBadgeProps) {
  const { hasUpdate, updateInfo } = useUpdate();
  const { t } = useTranslation();

  if (!hasUpdate || !updateInfo) {
    return null;
  }

  const title = t("settings.updateAvailable", {
    version: updateInfo.availableVersion ?? "",
  });

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`
        relative h-8 w-8 rounded-full
        text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10
        ${className}
      `}
    >
      <ArrowUpCircle className="h-4 w-4" />
    </Button>
  );
}
