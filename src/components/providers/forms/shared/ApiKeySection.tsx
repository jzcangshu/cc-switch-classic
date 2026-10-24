import { useTranslation } from "react-i18next";
import ApiKeyInput from "../ApiKeyInput";
import type { ProviderCategory } from "@/types";

interface ApiKeySectionProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  category?: ProviderCategory;
  shouldShowLink: boolean;
  websiteUrl: string;
  placeholder?: {
    official: string;
    thirdParty: string;
  };
  disabled?: boolean;
  /** 保存时会校验 Key 非空的表单才传；官方 / 云厂商 / 禁用时不标星 */
  required?: boolean;
  isPartner?: boolean;
  partnerPromotionKey?: string;
}

export function ApiKeySection({
  id,
  label,
  value,
  onChange,
  category,
  shouldShowLink,
  websiteUrl,
  placeholder,
  disabled,
  required = false,
  partnerPromotionKey,
}: ApiKeySectionProps) {
  const { t } = useTranslation();

  const defaultPlaceholder = {
    official: t("providerForm.officialNoApiKey", {
      defaultValue: "官方供应商无需 API Key",
    }),
    thirdParty: t("providerForm.apiKeyAutoFill", {
      defaultValue: "输入 API Key，将自动填充到配置",
    }),
  };

  const finalPlaceholder = placeholder || defaultPlaceholder;
  const isDisabled = disabled ?? category === "official";
  const isRequired =
    required &&
    !isDisabled &&
    category !== "official" &&
    category !== "cloud_provider";

  const showLink = shouldShowLink && Boolean(websiteUrl);
  const promotion =
    showLink && partnerPromotionKey
      ? t(`providerForm.partnerPromotion.${partnerPromotionKey}`, {
          defaultValue: "",
        })
      : "";

  return (
    <div className="space-y-1">
      <ApiKeyInput
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        placeholder={
          category === "official"
            ? finalPlaceholder.official
            : finalPlaceholder.thirdParty
        }
        disabled={isDisabled}
        required={isRequired}
      />
      {showLink && (
        <div className="-mt-1 space-y-2 pl-1">
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-caption text-blue-400 dark:text-blue-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            {t("providerForm.getApiKey", { defaultValue: "获取 API Key" })}
          </a>
          {promotion && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-2.5 dark:border-blue-800 dark:bg-blue-950/30">
              <p className="text-xs leading-relaxed text-blue-700 dark:text-blue-300">
                💡 {promotion}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
