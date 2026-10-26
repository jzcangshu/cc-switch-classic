import type { ProviderCategory } from "@/types";
import type { PresetFamilyFields } from "./presetFamilies";

/**
 * Gemini 预设供应商的视觉主题配置
 */
export interface GeminiPresetTheme {
  /** 图标类型：'gemini' | 'generic' */
  icon?: "gemini" | "generic";
  /** 背景色（选中状态），支持 hex 颜色 */
  backgroundColor?: string;
  /** 文字色（选中状态），支持 hex 颜色 */
  textColor?: string;
}

export interface GeminiProviderPreset extends PresetFamilyFields {
  name: string;
  nameKey?: string; // i18n key for localized display name
  websiteUrl: string;
  apiKeyUrl?: string;
  settingsConfig: object;
  baseURL?: string;
  model?: string;
  description?: string;
  category?: ProviderCategory;
  isPartner?: boolean;
  partnerPromotionKey?: string;
  endpointCandidates?: string[];
  theme?: GeminiPresetTheme;
  // 图标配置
  icon?: string; // 图标名称
  iconColor?: string; // 图标颜色
}

export const geminiProviderPresets: GeminiProviderPreset[] = [
  // ===== 非赞助商预设：应用内展示按显示名排序，此处文件顺序不影响展示 =====
  {
    name: "Google Official",
    websiteUrl: "https://ai.google.dev/",
    apiKeyUrl: "https://aistudio.google.com/apikey",
    settingsConfig: {
      env: {},
    },
    description: "Google 官方 Gemini API (OAuth)",
    category: "official",
    partnerPromotionKey: "google-official",
    theme: {
      icon: "gemini",
      backgroundColor: "#4285F4",
      textColor: "#FFFFFF",
    },
    icon: "gemini",
    iconColor: "#4285F4",
  },
  {
    name: "Tu-zi",
    nameKey: "providerForm.presets.tuzi",
    websiteUrl: "https://api.tu-zi.com",
    apiKeyUrl: "https://api.tu-zi.com/token",
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: "https://api.tu-zi.com",
        GEMINI_API_KEY: "",
        GEMINI_MODEL: "gemini-3.8-flash",
      },
    },
    baseURL: "https://api.tu-zi.com",
    model: "gemini-3.8-flash",
    description: "Tu-zi",
    category: "aggregator",
    endpointCandidates: [
      "https://api.tu-zi.com",
      "https://api.ourzhishi.top",
      "https://api.sydney-ai.com",
      "https://apicdn.tu-zi.com",
    ],
    icon: "tuzi",
  },
  {
    name: "E-FlowCode",
    websiteUrl: "https://e-flowcode.cc",
    apiKeyUrl: "https://e-flowcode.cc",
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: "https://e-flowcode.cc",
        GEMINI_API_KEY: "",
        GEMINI_MODEL: "gemini-3.8-flash",
      },
      config: {
        general: {
          previewFeatures: true,
          sessionRetention: {
            enabled: true,
            maxAge: "30d",
            warningAcknowledged: true,
          },
        },
        mcpServers: {},
        security: {
          auth: {
            selectedType: "gemini-api-key",
          },
        },
      },
    },
    baseURL: "https://e-flowcode.cc",
    model: "gemini-3.8-flash",
    description: "E-FlowCode",
    category: "third_party",
    endpointCandidates: ["https://e-flowcode.cc"],
    icon: "eflowcode",
    iconColor: "#000000",
  },
  {
    name: "CherryIN",
    websiteUrl: "https://open.cherryin.ai",
    apiKeyUrl: "https://open.cherryin.ai/console/token",
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: "https://open.cherryin.net",
        GEMINI_API_KEY: "",
        GEMINI_MODEL: "google/gemini-3.8-flash",
      },
    },
    baseURL: "https://open.cherryin.net",
    model: "google/gemini-3.8-flash",
    description: "CherryIN",
    category: "aggregator",
    endpointCandidates: ["https://open.cherryin.net"],
    icon: "cherryin",
  },
  {
    name: "OpenRouter",
    websiteUrl: "https://openrouter.ai",
    apiKeyUrl: "https://openrouter.ai/keys",
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: "https://openrouter.ai/api",
        GEMINI_MODEL: "gemini-3.8-flash",
      },
    },
    baseURL: "https://openrouter.ai/api",
    model: "gemini-3.8-flash",
    description: "OpenRouter",
    category: "aggregator",
    icon: "openrouter",
    iconColor: "#6566F1",
  },
  {
    name: "TheRouter",
    websiteUrl: "https://therouter.ai",
    apiKeyUrl: "https://dashboard.therouter.ai",
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: "https://api.therouter.ai",
        GEMINI_MODEL: "gemini-3.8-flash",
      },
    },
    baseURL: "https://api.therouter.ai",
    model: "gemini-3.8-flash",
    description: "TheRouter",
    category: "aggregator",
    endpointCandidates: ["https://api.therouter.ai"],
    icon: "therouter",
  },
  {
    name: "AICodeWith",
    websiteUrl: "https://aicodewith.ai",
    apiKeyUrl: "https://aicodewith.ai/login?tab=register",
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: "https://api.aicodewith.ai/gemini_cli",
        GEMINI_MODEL: "gemini-4-argon",
      },
    },
    baseURL: "https://api.aicodewith.ai/gemini_cli",
    model: "gemini-4-argon",
    description: "AICodeWith",
    category: "aggregator",
    endpointCandidates: ["https://api.aicodewith.ai/gemini_cli"],
    icon: "aicodewith",
    iconColor: "#3A3B40",
  },
  {
    name: "SoruxGPT",
    websiteUrl: "https://ai.soruxgpt.com",
    apiKeyUrl: "https://ai.soruxgpt.com/console/token",
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: "https://ai.soruxgpt.com",
        GEMINI_MODEL: "gemini-4-argon",
      },
    },
    baseURL: "https://ai.soruxgpt.com",
    model: "gemini-4-argon",
    description: "SoruxGPT",
    category: "aggregator",
    endpointCandidates: [
      "https://ai.soruxgpt.com",
      "https://api-cf.soruxgpt.com",
      "https://api-host.soruxgpt.com",
      "https://api-node6.soruxgpt.com",
      "https://api-node3.soruxgpt.com",
    ],
    icon: "soruxgpt",
  },
  {
    name: "IKunCode",
    websiteUrl: "https://api.ikuncode.ai",
    apiKeyUrl: "https://api.ikuncode.ai/console/token",
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: "https://api.ikuncode.ai",
        GEMINI_MODEL: "gemini-4-argon",
      },
    },
    baseURL: "https://api.ikuncode.ai",
    model: "gemini-4-argon",
    description: "IKunCode",
    category: "aggregator",
    endpointCandidates: ["https://api.ikuncode.ai", "https://api.ikuncode.cc"],
    icon: "ikuncode",
  },
  {
    name: "RunToken",
    websiteUrl: "https://www.runtoken.ai",
    apiKeyUrl: "https://www.runtoken.ai/console/token",
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: "https://www.runtoken.ai",
        GEMINI_MODEL: "gemini-4-argon",
      },
    },
    baseURL: "https://www.runtoken.ai",
    model: "gemini-4-argon",
    description: "RunToken",
    category: "aggregator",
    endpointCandidates: ["https://www.runtoken.ai", "https://fast.runtoken.ai"],
    icon: "runtoken",
  },
  {
    name: "YYLX",
    nameKey: "providerForm.presets.yylx",
    websiteUrl: "https://yylx.io",
    apiKeyUrl: "https://app.yylx.io/keys",
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: "https://app.yylx.io",
        GEMINI_MODEL: "gemini-3.8-flash",
      },
    },
    baseURL: "https://app.yylx.io",
    model: "gemini-3.8-flash",
    description: "YYLX",
    category: "aggregator",
    endpointCandidates: [
      "https://app.yylx.io",
      "https://global.yylx.io",
      "https://cn.yylx.io",
    ],
    icon: "yylx",
  },
  {
    name: "TokenFlux",
    websiteUrl: "https://tokenflux.dev",
    apiKeyUrl: "https://tokenflux.dev/keys",
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: "https://tokenflux.dev",
        GEMINI_MODEL: "gemini-3.8-flash",
      },
    },
    baseURL: "https://tokenflux.dev",
    model: "gemini-3.8-flash",
    description: "TokenFlux",
    category: "aggregator",
    icon: "tokenflux",
  },
  {
    name: "AIComing",
    websiteUrl: "https://aicoming.top",
    apiKeyUrl: "https://aicoming.top/console#keys",
    settingsConfig: {
      env: {
        GOOGLE_GEMINI_BASE_URL: "https://api.aicoming.top",
        GEMINI_MODEL: "gemini-4-argon",
      },
    },
    baseURL: "https://api.aicoming.top",
    model: "gemini-4-argon",
    description: "AIComing",
    category: "aggregator",
    icon: "aicoming",
  },
];

export function getGeminiPresetByName(
  name: string,
): GeminiProviderPreset | undefined {
  return geminiProviderPresets.find((preset) => preset.name === name);
}

export function getGeminiPresetByUrl(
  url: string,
): GeminiProviderPreset | undefined {
  if (!url) return undefined;
  return geminiProviderPresets.find(
    (preset) =>
      preset.baseURL &&
      url.toLowerCase().includes(preset.baseURL.toLowerCase()),
  );
}
