import React from "react";
import { useTranslation } from "react-i18next";
import { MoreHorizontal, Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HoverTip } from "@/components/ui/hover-tip";
import type { Prompt } from "@/lib/api";
import { cn } from "@/lib/utils";
import { promptMenuContentClass, promptMenuItemClass } from "./PromptPageFrame";

interface PromptListItemProps {
  id: string;
  prompt: Prompt;
  /** 左侧开关显示当前启用状态。 */
  active: boolean;
  /** 第二行：说明（没有就用正文第一行）· 大小 · 更新时间 */
  detail: string;
  first: boolean;
  disabled?: boolean;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onCopyToApps?: (id: string) => void;
  onCopyContent?: (id: string) => void;
  /** 删除不能用时的原因（启用中的不能删） */
  deleteBlockedReason?: string;
}

/** 第三版独立提示卡：左侧启用开关，右侧编辑、删除和新增复制操作。 */
const PromptListItem: React.FC<PromptListItemProps> = ({
  id,
  prompt,
  active,
  detail,
  disabled = false,
  onToggle,
  onEdit,
  onDelete,
  onCopyToApps,
  onCopyContent,
  deleteBlockedReason,
}) => {
  const { t } = useTranslation();

  return (
    <li
      data-testid={`prompt-row-${id}`}
      className={cn(
        "group relative flex h-16 items-center gap-4 rounded-xl border border-border bg-muted/50 p-4 transition-colors duration-200 hover:bg-muted hover:shadow-sm",
      )}
    >
      <Switch
        checked={active}
        disabled={disabled}
        aria-label={t(active ? "prompts.disableAria" : "prompts.enableAria", {
          name: prompt.name,
        })}
        onCheckedChange={(enabled) => onToggle(id, enabled)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            title={prompt.name}
            className="min-w-0 truncate text-body font-medium text-fg-1"
          >
            {prompt.name}
          </span>
        </div>
        <span
          title={detail}
          className="min-w-0 truncate text-sm text-muted-foreground"
        >
          {prompt.description?.trim() || detail}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <HoverTip content={t("common.edit")}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={t("prompts.editAria", { name: prompt.name })}
            onClick={() => onEdit(id)}
          >
            <Edit3 size={16} />
          </Button>
        </HoverTip>
        <HoverTip content={deleteBlockedReason || t("common.delete")}>
          <span>
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled || Boolean(deleteBlockedReason)}
              aria-label={t("prompts.deleteAria", {
                name: prompt.name,
                defaultValue: "删除 {{name}}",
              })}
              onClick={() => onDelete(id)}
              className="hover:text-red-500 hover:bg-red-100 disabled:opacity-100 dark:hover:text-red-400 dark:hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </span>
        </HoverTip>
        {(onCopyToApps || onCopyContent) && (
          <DropdownMenu modal={false}>
            <HoverTip content={t("common.more")}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="quiet"
                  size="icon-compact"
                  disabled={disabled}
                  aria-label={t("prompts.rowMoreActions", {
                    name: prompt.name,
                  })}
                >
                  <MoreHorizontal
                    className="h-[15px] w-[15px]"
                    strokeWidth={1.5}
                  />
                </Button>
              </DropdownMenuTrigger>
            </HoverTip>
            <DropdownMenuContent
              align="end"
              className={cn(promptMenuContentClass, "w-[240px]")}
            >
              {onCopyToApps ? (
                <DropdownMenuItem
                  className={promptMenuItemClass}
                  onSelect={() => onCopyToApps(id)}
                >
                  {t("prompts.copyToApps")}
                </DropdownMenuItem>
              ) : null}
              {onCopyContent ? (
                <DropdownMenuItem
                  className={promptMenuItemClass}
                  onSelect={() => onCopyContent(id)}
                >
                  {t("prompts.copyContent")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
};

export default PromptListItem;
