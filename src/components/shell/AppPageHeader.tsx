import { createContext, useContext, type ReactNode } from "react";
import { DRAG_REGION_ATTR, DRAG_REGION_STYLE } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/** 由外壳提供：Linux 自绘窗口按钮要接在每一屏页头的最右端。 */
export const WindowControlsContext = createContext<ReactNode>(null);
export const PageBackContext = createContext<(() => void) | null>(null);

const NO_DRAG = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

interface AppPageHeaderProps {
  /** 标题前的可操作元素（二级页的返回按钮）；和 icon 二选一 */
  leading?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
  headingLevel?: 1 | 2;
  /** 应用页用 16px 的名字 + 13px 的页面名；全局页和设置用 18px 的页面标题 */
  variant?: "app" | "page";
  /** 应用页的页面名（如「供应商」），灰字跟在应用名后面 */
  subtitle?: ReactNode;
  /** 标题后面的「?」、Beta 徽标、计数等 */
  titleExtra?: ReactNode;
  /** 右侧操作区：主按钮放最后一个、⋯ 放它后面 */
  actions?: ReactNode;
  /** 标题可能很长（如会话阅读页的会话名）：标题占满剩余宽度，放不下就截断 */
  truncateTitle?: boolean;
  className?: string;
}

/**
 * 内容区页头：高 52，整条可拖动窗口，左边是图标 + 标题，右边是操作。
 */
export function AppPageHeader({
  leading,
  icon,
  title,
  headingLevel = 1,
  subtitle,
  titleExtra,
  actions,
  truncateTitle = false,
  className,
}: AppPageHeaderProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const windowControls = useContext(WindowControlsContext);
  const onBack = useContext(PageBackContext);
  const { t } = useTranslation();
  const backButton =
    leading ??
    (onBack && (
      <Button
        variant="outline"
        size="icon"
        className="rounded-lg"
        onClick={onBack}
        aria-label={t("common.back")}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
    ));
  return (
    <header
      className={cn(
        "relative flex h-16 shrink-0 items-center gap-4 bg-background/80 px-6 backdrop-blur-md",
        windowControls && "pe-[116px]",
        className,
      )}
      {...DRAG_REGION_ATTR}
      style={DRAG_REGION_STYLE as React.CSSProperties}
    >
      {/* Tauri 只认按下的元素自身带拖动属性：标题区、标题、占位条都要带，整条才能拖窗口 */}
      <div
        {...DRAG_REGION_ATTR}
        className={cn(
          "flex min-w-0 items-center gap-2.5",
          truncateTitle ? "flex-1" : "shrink-0",
        )}
      >
        {backButton && (
          <span className="flex shrink-0 items-center" style={NO_DRAG}>
            {backButton}
          </span>
        )}
        {icon && !backButton && (
          <span
            aria-hidden="true"
            className="pointer-events-none flex h-[22px] w-[22px] shrink-0 items-center justify-center text-fg-1"
          >
            {icon}
          </span>
        )}
        <Heading
          {...DRAG_REGION_ATTR}
          className={cn(
            "m-0 whitespace-nowrap",
            "text-lg font-semibold",
            truncateTitle && "min-w-0 truncate",
          )}
        >
          {title}
        </Heading>
        {(subtitle || titleExtra) && (
          <div className="flex min-w-0 items-center gap-1" style={NO_DRAG}>
            {subtitle && (
              <span className="whitespace-nowrap text-body text-fg-3">
                {subtitle}
              </span>
            )}
            {titleExtra}
          </div>
        )}
      </div>
      {!truncateTitle && <div {...DRAG_REGION_ATTR} className="flex-1" />}
      {actions && (
        <div
          className="flex min-w-0 shrink items-center justify-end gap-2"
          style={NO_DRAG}
        >
          {actions}
        </div>
      )}
      {windowControls && (
        <div
          className="absolute end-4 top-4 flex items-center gap-1"
          style={NO_DRAG}
        >
          {windowControls}
        </div>
      )}
    </header>
  );
}
