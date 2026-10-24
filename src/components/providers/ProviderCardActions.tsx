import type * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  BarChart3,
  Check,
  ChevronDown,
  Copy,
  Edit,
  Loader2,
  Minus,
  MoreHorizontal,
  Play,
  Plug,
  Plus,
  Terminal,
  Trash2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DisabledReason } from "@/components/ui/help-tip";
import { HoverTip } from "@/components/ui/hover-tip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CardButton, CardPresentation } from "./presentation";

/** 操作含义由第四版的卡片呈现模型决定，这里只负责按钮的文字与图标。 */
const BUTTON_ICON: Record<string, LucideIcon> = {
  switch: Play,
  exitAndUse: Plug,
  routeHere: Play,
  queueAdd: Plus,
  queueRemove: Check,
  setDefault: Zap,
  add: Plus,
  remove: Minus,
  enable: Play,
  use: Zap,
  disable: Check,
  openTerminal: Terminal,
};

interface ProviderCardActionsProps {
  providerName: string;
  presentation: CardPresentation;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  onTest?: () => void;
  isTesting?: boolean;
  onConfigureUsage?: () => void;
  onOpenTerminal?: () => void;
}

/**
 * 第三版的文字主按钮和常用操作栏。第四版新增的模式菜单与禁用原因继续使用原来的呈现模型。
 */
export function ProviderCardActions({
  providerName,
  presentation,
  onEdit,
  onDelete,
  onDuplicate,
  onTest,
  isTesting,
  onConfigureUsage,
  onOpenTerminal,
}: ProviderCardActionsProps) {
  const { t } = useTranslation();
  const { status, buttons, menuItems = [] } = presentation;
  const iconButtonClass = "h-8 w-8 p-1";

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 transition-opacity duration-200 sm:opacity-0 sm:pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 group-hover:pointer-events-auto group-focus-within:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto">
      {status && (
        <Button
          variant="secondary"
          size="sm"
          disabled
          className="min-w-[4.5rem] px-2.5 bg-gray-200 text-muted-foreground hover:bg-gray-200 hover:text-muted-foreground dark:bg-gray-700 dark:hover:bg-gray-700"
        >
          {status.icon === "default" ? (
            <Zap className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          {status.label}
        </Button>
      )}
      {buttons.map((button) => (
        <PrimaryButton key={button.key} button={button} />
      ))}
      <div className="flex flex-wrap items-center justify-end gap-1">
        <IconAction
          tip={t("common.edit")}
          disabledReason={presentation.editDisabledReason}
        >
          <Button
            variant="ghost"
            size="icon"
            className={iconButtonClass}
            aria-label={t("providerCard.action.edit", { name: providerName })}
            onClick={onEdit}
          >
            <Edit className="h-4 w-4" aria-hidden="true" />
          </Button>
        </IconAction>

        {onDuplicate && (
          <HoverTip content={t("provider.duplicate")}>
            <Button
              variant="ghost"
              size="icon"
              className={iconButtonClass}
              aria-label={t("provider.duplicate")}
              onClick={onDuplicate}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
            </Button>
          </HoverTip>
        )}
        <HoverTip content={t("provider.connectivityCheck")}>
          <span>
            <Button
              variant="ghost"
              size="icon"
              className={iconButtonClass}
              aria-label={t("provider.connectivityCheck")}
              disabled={!onTest || isTesting}
              onClick={onTest}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Activity className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </span>
        </HoverTip>
        <HoverTip content={t("provider.configureUsage")}>
          <span>
            <Button
              variant="ghost"
              size="icon"
              className={iconButtonClass}
              aria-label={t("provider.configureUsage")}
              disabled={!onConfigureUsage}
              onClick={onConfigureUsage}
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </span>
        </HoverTip>
        {onOpenTerminal && (
          <HoverTip content={t("provider.openTerminal")}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("provider.openTerminal")}
              onClick={onOpenTerminal}
              className={cn(
                iconButtonClass,
                "hover:text-emerald-600 dark:hover:text-emerald-400",
              )}
            >
              <Terminal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </HoverTip>
        )}
        <IconAction
          tip={t("common.delete")}
          disabledReason={presentation.deleteDisabledReason}
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common.delete")}
            onClick={onDelete}
            className={cn(
              iconButtonClass,
              !presentation.deleteDisabledReason &&
                "hover:text-red-500 dark:hover:text-red-400",
            )}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </IconAction>

        {menuItems.length > 0 && (
          <DropdownMenu>
            <HoverTip content={t("common.more")}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={iconButtonClass}
                  aria-label={t("providerCard.action.more", {
                    name: providerName,
                  })}
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
            </HoverTip>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              {menuItems.map((item) => (
                <DropdownMenuItem
                  key={item.key}
                  disabled={Boolean(item.disabledReason)}
                  onSelect={item.onSelect}
                  className="flex-col items-start gap-0.5"
                >
                  {item.label}
                  {item.disabledReason && (
                    <span className="max-w-64 text-caption text-fg-3">
                      {item.disabledReason}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

/** 有禁用原因时只挂说明卡（报原因），否则挂 HoverTip（报名字），两者不叠。 */
function IconAction({
  tip,
  disabledReason,
  children,
}: {
  tip: string;
  disabledReason?: string;
  children: React.ReactElement;
}) {
  if (disabledReason) {
    return (
      <DisabledReason reason={disabledReason} align="end">
        {children}
      </DisabledReason>
    );
  }
  return <HoverTip content={tip}>{children}</HoverTip>;
}

function PrimaryButton({ button }: { button: CardButton }) {
  const Icon = BUTTON_ICON[button.key] ?? Play;
  const icon = <Icon className="h-4 w-4" aria-hidden="true" />;
  const secondary = ["remove", "queueRemove", "disable"].includes(button.key);
  const className = cn(
    "min-w-[4.5rem] px-2.5",
    (button.key === "routeHere" || button.key === "add") &&
      "bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700",
    // 第三版的「加入」是蓝色底，「已加入」保持浅蓝
    button.key === "queueAdd" &&
      "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700",
    button.key === "remove" &&
      "bg-orange-100 text-orange-600 hover:bg-orange-200 dark:bg-orange-900/50 dark:text-orange-400 dark:hover:bg-orange-900/70",
    button.key === "queueRemove" &&
      "bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-900/70",
    button.key === "disable" &&
      "bg-gray-200 text-muted-foreground hover:bg-gray-200 hover:text-muted-foreground dark:bg-gray-700 dark:hover:bg-gray-700",
  );
  if (button.menu && !button.disabledReason) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={secondary ? "secondary" : "default"}
            size="sm"
            aria-label={button.label}
            className={className}
          >
            {icon}
            {button.label}
            <ChevronDown
              className="h-3.5 w-3.5 opacity-70"
              aria-hidden="true"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="max-h-72 min-w-64 overflow-y-auto"
        >
          <DropdownMenuLabel>{button.menu.title}</DropdownMenuLabel>
          {button.menu.options.map((option) => (
            <DropdownMenuItem
              key={option.key}
              onSelect={option.onSelect}
              className="flex min-w-0 flex-col items-start gap-0.5"
            >
              <span className="max-w-72 truncate">{option.label}</span>
              {option.detail && (
                <span className="max-w-72 truncate font-mono text-caption text-fg-3">
                  {option.detail}
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return (
    <DisabledReason reason={button.disabledReason} align="end">
      <Button
        variant={secondary ? "secondary" : "default"}
        size="sm"
        className={className}
        aria-label={button.label}
        onClick={button.onClick}
      >
        {icon}
        {button.label}
      </Button>
    </DisabledReason>
  );
}
