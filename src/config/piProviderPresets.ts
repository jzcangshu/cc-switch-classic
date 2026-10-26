import type { ProviderCategory } from "@/types";
import type { PresetTheme } from "./claudeProviderPresets";
import {
  getPiModelCatalogReference,
  piModel,
  type PiCatalogModel,
} from "./piModelCatalog";
import {
  getPiThinkingProfile,
  resolvePiThinkingProfile,
  type PiThinkingLevelMap,
} from "./piThinkingProfiles";
import type { PresetFamilyFields } from "./presetFamilies";

export type PiApiFormat =
  | "openai-completions"
  | "openai-responses"
  | "anthropic-messages"
  | "google-generative-ai"
  | "bedrock-converse-stream";

export type PiPresetModel = PiCatalogModel & {
  thinkingLevelMap?: PiThinkingLevelMap;
  compat?: Record<string, unknown>;
};

export interface PiProviderPreset extends PresetFamilyFields {
  name: string;
  nameKey?: string;
  providerKey: string;
  websiteUrl: string;
  apiKeyUrl?: string;
  settingsConfig: {
    name: string;
    baseUrl: string;
    api: PiApiFormat;
    apiKey: string;
    headers?: Record<string, string>;
    compat?: Record<string, unknown>;
    models: PiPresetModel[];
  };
  category?: ProviderCategory;
  isPartner?: boolean;
  partnerPromotionKey?: string;
  theme?: PresetTheme;
  icon?: string;
  iconColor?: string;
}

const OPENAI_COMPLETIONS_COMPAT = {
  supportsStore: false,
  supportsDeveloperRole: false,
  maxTokensField: "max_tokens",
} as const;

// 1823/132248: thinking.type defaults to "enabled"; disabling requires an explicit
// {"type":"disabled"}. The same doc says reasoning_content need not be echoed back
// on multi-turn, so we don't reuse DEEPSEEK_THINKING_COMPAT wholesale.
const TENCENT_DEEPSEEK_THINKING_COMPAT = {
  ...OPENAI_COMPLETIONS_COMPAT,
  thinkingFormat: "deepseek",
} as const;

const XIAOMI_THINKING_COMPAT = {
  requiresReasoningContentOnAssistantMessages: true,
  thinkingFormat: "deepseek",
} as const;

// DashScope's /compatible-mode/v1 returns reasoning in Qwen's own envelope and
// rejects the `developer` role, so neither OpenAI nor DeepSeek thinking applies.
const QWEN_THINKING_COMPAT = {
  thinkingFormat: "qwen",
  supportsDeveloperRole: false,
} as const;

const KIMI_K3_COMPAT = {
  supportsStore: false,
  supportsDeveloperRole: false,
  supportsReasoningEffort: true,
  maxTokensField: "max_tokens",
  supportsStrictMode: false,
  thinkingFormat: "openai",
  requiresReasoningContentOnAssistantMessages: true,
  deferredToolsMode: "kimi",
} as const;

/**
 * Pi-native provider catalog.
 *
 * This list is independently maintained because provider protocol, endpoint
 * roots and model capabilities are application-specific. It was initially
 * aligned with the OpenCode catalog, but Pi does not import or derive from
 * another application's presets at runtime.
 */
const piProviderPresetDefinitions: PiProviderPreset[] = [
  {
    name: "Kimi",
    family: "kimi",
    planKey: "payg",
    regionKey: "cn",
    providerKey: "cc-switch-kimi",
    websiteUrl:
      "https://platform.kimi.com?track_id=track-7cf2b91dcde043eda6ef9a95951a042c&aff=cc-switch",
    apiKeyUrl: "https://platform.kimi.com/console/api-keys?aff=cc-switch",
    settingsConfig: {
      name: "Kimi",
      baseUrl: "https://api.moonshot.cn/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("moonshotai/kimi-k2.7-code", {
          id: "kimi-k2.7-code",
          thinkingProfile: "offUnsupported",
        }),
        {
          ...piModel("moonshotai/kimi-k3", {
            id: "kimi-k3",
            thinkingProfile: "kimi3",
          }),
          compat: { ...KIMI_K3_COMPAT },
        },
        piModel("moonshotai/kimi-k2.7-code-highspeed", {
          id: "kimi-k2.7-code-highspeed",
          thinkingProfile: "offUnsupported",
        }),
        piModel("moonshotai/kimi-k2.6", { id: "kimi-k2.6" }),
      ],
    },
    category: "cn_official",
    partnerPromotionKey: "kimi",
    icon: "kimi",
    iconColor: "#6366F1",
  },
  // API 开放平台海外/Global 变体：platform.kimi.ai + api.moonshot.ai 端点
  {
    name: "Kimi Global",
    family: "kimi",
    planKey: "payg",
    regionKey: "intl",
    providerKey: "cc-switch-kimi-global",
    websiteUrl:
      "https://platform.kimi.ai?track_id=track-674ed6e2af924a5682a87421f7cf753a&aff=cc-switch",
    apiKeyUrl: "https://platform.kimi.ai/console/api-keys?aff=cc-switch",
    settingsConfig: {
      name: "Kimi",
      baseUrl: "https://api.moonshot.ai/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("moonshotai/kimi-k2.7-code", {
          id: "kimi-k2.7-code",
          thinkingProfile: "offUnsupported",
        }),
        {
          ...piModel("moonshotai/kimi-k3", {
            id: "kimi-k3",
            thinkingProfile: "kimi3",
          }),
          compat: { ...KIMI_K3_COMPAT },
        },
        piModel("moonshotai/kimi-k2.7-code-highspeed", {
          id: "kimi-k2.7-code-highspeed",
          thinkingProfile: "offUnsupported",
        }),
        piModel("moonshotai/kimi-k2.6", { id: "kimi-k2.6" }),
      ],
    },
    category: "cn_official",
    partnerPromotionKey: "kimi",
    icon: "kimi",
    iconColor: "#6366F1",
  },
  {
    name: "Kimi For Coding",
    family: "kimi",
    planKey: "coding",
    regionKey: "cn",
    providerKey: "cc-switch-kimi-for-coding",
    websiteUrl: "https://www.kimi.com/code/?aff=cc-switch",
    apiKeyUrl: "https://platform.kimi.com/console/api-keys?aff=cc-switch",
    settingsConfig: {
      name: "Kimi For Coding",
      baseUrl: "https://api.kimi.com/coding",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("moonshotai/kimi-k2.7-code", {
          id: "kimi-for-coding",
          name: "Kimi For Coding",
          maxTokens: 32768,
        }),
      ],
    },
    category: "cn_official",
    icon: "kimi",
    iconColor: "#6366F1",
  },
  // 海外/Global 变体：kimi.ai/code + api.kimi.ai 端点，其余与国内版一致
  {
    name: "Kimi For Coding Global",
    family: "kimi",
    planKey: "coding",
    regionKey: "intl",
    providerKey: "cc-switch-kimi-for-coding-global",
    websiteUrl: "https://www.kimi.ai/code?aff=cc-switch",
    apiKeyUrl: "https://www.kimi.ai/code?aff=cc-switch",
    settingsConfig: {
      name: "Kimi For Coding",
      baseUrl: "https://api.kimi.ai/coding",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("moonshotai/kimi-k2.7-code", {
          id: "kimi-for-coding",
          name: "Kimi For Coding",
          maxTokens: 32768,
        }),
      ],
    },
    category: "cn_official",
    icon: "kimi",
    iconColor: "#6366F1",
  },
  {
    name: "TokenFactory",
    nameKey: "providerForm.presets.tokenfactory",
    providerKey: "cc-switch-tokenfactory",
    websiteUrl: "https://tokenfactory.cn",
    apiKeyUrl: "https://console.tokenfactory.cn/login",
    settingsConfig: {
      name: "TokenFactory",
      // 官方 Pi 文档（docs.tokenfactory.cn/tools/pi，2026-10-15 核对）；
      // 平台入口最大输出 128K，低于目录里的 131072，须覆盖
      baseUrl: "https://api.tokenfactory.cn/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("zai/glm-5.3", { id: "glm-5.3", maxTokens: 128_000 }),
        piModel("moonshotai/kimi-k3", { id: "kimi-k3" }),
        piModel("deepseek/deepseek-v4-pro", {
          id: "deepseek-v4-pro-0813",
          contextWindow: 1_048_576,
        }),
        // V4.1 Flash 1017 为较新的带日期构建，窗口与最大输出取站点目录
        piModel("deepseek/deepseek-flash", {
          id: "deepseek-v4.1-flash-1017",
          name: "DeepSeek V4.1 Flash 1017",
          contextWindow: 1_000_000,
          maxTokens: 384_000,
        }),
        // V4.1 Flash 平台标注可看图，目录里的 V4 Flash 只收文本
        piModel("deepseek/deepseek-v4-flash", {
          id: "deepseek-v4.1-flash",
          name: "DeepSeek V4.1 Flash",
          input: ["text", "image"],
          contextWindow: 1_048_576,
        }),
        piModel("zai/glm-5.3-flash", {
          id: "glm-5.3-flash",
          maxTokens: 128_000,
        }),
        piModel("qwen/qwen3.8-flash", {
          id: "qwen3.8-flash",
          maxTokens: 128_000,
        }),
      ],
    },
    category: "aggregator",
    icon: "tokenfactory",
  },
  // FluxA AgentMarket 以合作价转售的百度智能云 TokenPlan：产品页写明
  // "purchase it through AgentMarket, then use Baidu AI Cloud's endpoint and
  // API key directly"，端点取其所链的百度国际站 Token Plan Enterprise 文档
  // （2026-09-16 版）team 专属基址 —— 与国内个人版 qianfan.baidubce.com/
  // .../personal 是两套部署，勿合并。阵容与 claude/codex/opencode/openclaw/
  // hermes 五 app 的 FluxA 预设同源：七款取 FluxA 产品页模型表（排除标
  // Coming soon 的 deepseek-v4-pro-0813 / glm-5.3），kimi-k2.6 是定稿赞助
  // 文案点名补的。deepseek-v4-flash-0731 无独立目录键，按 v4-flash 同款
  // 能力取用、id 写真实 wire 名。思考档位（thinkingProfile）不填：国内版
  // 有、国际 team 部署未实测，与 Codex 侧不声明 codexChatReasoning 同理
  {
    name: "Code0",
    providerKey: "cc-switch-code0",
    websiteUrl: "https://code0.ai",
    apiKeyUrl: "https://code0.ai/agent/register/B2XHxGjGmRvqgznY",
    settingsConfig: {
      name: "Code0",
      baseUrl: "https://code0.ai/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("openai/gpt-6.1-sol", {
          id: "gpt-6.1-sol",
        }),
        piModel("openai/gpt-6-astra", { id: "gpt-6-astra" }),
      ],
    },
    category: "aggregator",
    icon: "code0",
  },
  {
    name: "火山 Agent Plan",
    family: "volcengine",
    planKey: "agentPlan",
    providerKey: "cc-switch-agentplan",
    websiteUrl:
      "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    apiKeyUrl:
      "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    settingsConfig: {
      name: "火山 Agent Plan",
      baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("volcengine/ark-code-latest", {
          id: "ark-code-latest",
        }),
      ],
    },
    category: "cn_official",
    isPartner: true,
    partnerPromotionKey: "volcengine_agentplan",
    icon: "huoshan",
    iconColor: "#3370FF",
  },
  {
    name: "火山 Coding Plan",
    family: "volcengine",
    planKey: "codingPlan",
    providerKey: "cc-switch-codingplan",
    websiteUrl:
      "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    apiKeyUrl:
      "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    settingsConfig: {
      name: "火山 Coding Plan",
      baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("volcengine/ark-code-latest", {
          id: "ark-code-latest",
        }),
      ],
    },
    category: "cn_official",
    isPartner: true,
    partnerPromotionKey: "volcengine_codingplan",
    icon: "huoshan",
    iconColor: "#3370FF",
  },
  {
    name: "BytePlus",
    providerKey: "cc-switch-byte-plus",
    websiteUrl:
      "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    apiKeyUrl:
      "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    settingsConfig: {
      name: "BytePlus",
      baseUrl: "https://ark.ap-southeast.bytepluses.com/api/coding/v3",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("volcengine/ark-code-latest", {
          id: "ark-code-latest",
        }),
      ],
    },
    category: "cn_official",
    isPartner: true,
    partnerPromotionKey: "byteplus",
    icon: "byteplus",
    iconColor: "#3370FF",
  },
  {
    name: "Volcengine Doubao",
    family: "volcengine",
    planKey: "payg",
    nameKey: "providerForm.presets.doubaoseed",
    providerKey: "cc-switch-dou-bao-seed",
    websiteUrl:
      "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    apiKeyUrl:
      "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    settingsConfig: {
      name: "Volcengine Doubao",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("volcengine/doubao-seed-2.1-pro", {
          id: "doubao-seed-2-1-pro-260915",
        }),
      ],
    },
    category: "cn_official",
    isPartner: true,
    partnerPromotionKey: "doubaoseed",
    icon: "doubao",
    iconColor: "#3370FF",
  },
  {
    name: "Amux",
    providerKey: "cc-switch-amux",
    websiteUrl: "https://amux.ai",
    apiKeyUrl: "https://amux.ai",
    settingsConfig: {
      name: "Amux",
      baseUrl: "https://api.amux.ai/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("openai/gpt-6.1-sol", {
          id: "gpt-6.1-sol",
        }),
        piModel("openai/gpt-6-astra", { id: "gpt-6-astra" }),
      ],
    },
    category: "aggregator",
    icon: "amux",
  },
  {
    name: "AtlasCloud",
    providerKey: "cc-switch-atlas-cloud",
    websiteUrl: "https://www.atlascloud.ai/console/coding-plan",
    apiKeyUrl: "https://www.atlascloud.ai/console/coding-plan",
    settingsConfig: {
      name: "AtlasCloud",
      baseUrl: "https://api.atlascloud.ai/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("zai/glm-5.3", { id: "zai-org/glm-5.3" }),
        piModel("zai/glm-5.3-flash", { id: "zai-org/glm-5.3-flash" }),
        piModel("moonshotai/kimi-k3", { id: "moonshotai/kimi-k3" }),
      ],
    },
    category: "aggregator",
    icon: "atlascloud",
  },
  {
    name: "Soshow",
    providerKey: "cc-switch-soshow",
    websiteUrl: "https://aimarket.so-show.com",
    apiKeyUrl: "https://aimarket.so-show.com/workbench/access-key",
    settingsConfig: {
      name: "Soshow",
      baseUrl: "https://maas.so-show.com",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("anthropic/claude-sonnet-5", {
          id: "claude-sonnet-5",
        }),
        piModel("anthropic/claude-opus-5", {
          id: "claude-opus-5",
        }),
      ],
    },
    category: "aggregator",
    icon: "soshow",
  },
  {
    name: "DeepSeek",
    providerKey: "cc-switch-deep-seek",
    websiteUrl: "https://platform.deepseek.com",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    settingsConfig: {
      name: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("deepseek/deepseek-v4-pro", {
          id: "deepseek-v4-pro",
          thinkingProfile: "deepseekV4",
        }),
        piModel("deepseek/deepseek-flash", {
          id: "deepseek-flash",
          thinkingProfile: "deepseekV4",
        }),
      ],
    },
    category: "cn_official",
    icon: "deepseek",
    iconColor: "#1E88E5",
  },
  {
    name: "Zhipu GLM",
    family: "zhipu",
    regionKey: "cn",
    providerKey: "cc-switch-zhipu-glm",
    websiteUrl: "https://open.bigmodel.cn",
    apiKeyUrl: "https://www.bigmodel.cn/claude-code",
    settingsConfig: {
      name: "Zhipu GLM",
      baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("zai/glm-5.3", {
          id: "glm-5.3",
        }),
        piModel("zai/glm-5.3-flash", { id: "glm-5.3-flash" }),
      ],
    },
    category: "cn_official",
    icon: "zhipu",
    iconColor: "#0F62FE",
  },
  {
    name: "Zhipu GLM en",
    family: "zhipu",
    regionKey: "intl",
    providerKey: "cc-switch-zhipu-glm-en",
    websiteUrl: "https://z.ai",
    apiKeyUrl: "https://z.ai/subscribe",
    settingsConfig: {
      name: "Zhipu GLM en",
      baseUrl: "https://api.z.ai/api/coding/paas/v4",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("zai/glm-5.3", {
          id: "glm-5.3",
        }),
        piModel("zai/glm-5.3-flash", { id: "glm-5.3-flash" }),
      ],
    },
    category: "cn_official",
    icon: "zhipu",
    iconColor: "#0F62FE",
  },
  {
    name: "千问AI平台",
    family: "qianwen",
    planKey: "payg",
    providerKey: "cc-switch-qianwenai",
    websiteUrl: "https://platform.qianwenai.com/?utm_content=g_20000002971",
    apiKeyUrl:
      "https://platform.qianwenai.com/home/api-keys?utm_content=g_20000002972",
    settingsConfig: {
      name: "千问AI平台",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        {
          ...piModel("qwen/qwen3.8-max", {
            id: "qwen3.8-max",
          }),
          compat: { ...QWEN_THINKING_COMPAT },
        },
      ],
    },
    category: "cn_official",
    icon: "qianwenai",
    iconColor: "#624AFF",
  },
  {
    name: "千问AI平台 Token Plan",
    family: "qianwen",
    planKey: "tokenPlan",
    providerKey: "cc-switch-qianwenai-token-plan",
    websiteUrl:
      "https://platform.qianwenai.com/pricing/token-plan?utm_content=g_20000002977",
    apiKeyUrl:
      "https://platform.qianwenai.com/home/api-keys?utm_content=g_20000002978",
    settingsConfig: {
      name: "千问AI平台 Token Plan",
      baseUrl:
        "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        {
          ...piModel("qwen/qwen3.8-max", { id: "qwen3.8-max" }),
          compat: { ...QWEN_THINKING_COMPAT },
        },
        {
          ...piModel("qwen/qwen3.8-flash", { id: "qwen3.8-flash" }),
          compat: { ...QWEN_THINKING_COMPAT },
        },
      ],
    },
    category: "cn_official",
    icon: "qianwenai",
    iconColor: "#624AFF",
  },
  // ===== QwenCloud（DashScope 国际站）=====
  // 与上面国内条目是两套独立站点：域名、控制台、密钥互不通用。
  // 按量付费与 Token Plan 都走 OpenAI 兼容层（/compatible-mode/v1）。
  {
    name: "QwenCloud",
    family: "qwencloud",
    planKey: "payg",
    providerKey: "cc-switch-qwencloud",
    websiteUrl: "https://home.qwencloud.com/?utm_content=g_20000002974",
    apiKeyUrl: "https://home.qwencloud.com/api-keys?utm_content=g_20000002975",
    settingsConfig: {
      name: "QwenCloud",
      baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        {
          ...piModel("qwen/qwen3.8-max", { id: "qwen3.8-max" }),
          compat: { ...QWEN_THINKING_COMPAT },
        },
        {
          ...piModel("qwen/qwen3.8-flash", { id: "qwen3.8-flash" }),
          compat: { ...QWEN_THINKING_COMPAT },
        },
        {
          ...piModel("qwen/qwen3.7-max", { id: "qwen3.7-max" }),
          compat: { ...QWEN_THINKING_COMPAT },
        },
      ],
    },
    category: "cn_official",
    icon: "qwencloud",
    iconColor: "#6336E7",
  },
  {
    name: "QwenCloud For Coding",
    family: "qwencloud",
    planKey: "coding",
    providerKey: "cc-switch-qwencloud-coding",
    websiteUrl: "https://www.qwencloud.com",
    apiKeyUrl: "https://home.qwencloud.com/api-keys",
    settingsConfig: {
      name: "QwenCloud For Coding",
      baseUrl: "https://coding-intl.dashscope.aliyuncs.com/apps/anthropic",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("qwen/qwen3.7-plus", { id: "qwen3.7-plus" }),
        piModel("qwen/qwen3-coder-plus", {
          id: "qwen3-coder-plus",
          contextWindow: 131_072,
        }),
      ],
    },
    category: "cn_official",
    icon: "qwencloud",
    iconColor: "#6336E7",
  },
  {
    name: "QwenCloud Token Plan",
    family: "qwencloud",
    planKey: "tokenPlan",
    providerKey: "cc-switch-qwencloud-token-plan",
    websiteUrl:
      "https://www.qwencloud.com/pricing/token-plan?utm_content=g_20000002980",
    apiKeyUrl: "https://home.qwencloud.com/api-keys?utm_content=g_20000002981",
    settingsConfig: {
      name: "QwenCloud Token Plan",
      baseUrl:
        "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        {
          ...piModel("qwen/qwen3.8-max", { id: "qwen3.8-max" }),
          compat: { ...QWEN_THINKING_COMPAT },
        },
        {
          ...piModel("qwen/qwen3.8-flash", { id: "qwen3.8-flash" }),
          compat: { ...QWEN_THINKING_COMPAT },
        },
        {
          ...piModel("qwen/qwen3.7-max", { id: "qwen3.7-max" }),
          compat: { ...QWEN_THINKING_COMPAT },
        },
      ],
    },
    category: "cn_official",
    icon: "qwencloud",
    iconColor: "#6336E7",
  },
  {
    name: "StepFun",
    family: "stepfun",
    regionKey: "cn",
    providerKey: "cc-switch-step-fun",
    websiteUrl: "https://platform.stepfun.com/step-plan",
    apiKeyUrl: "https://platform.stepfun.com/interface-key",
    settingsConfig: {
      name: "StepFun",
      baseUrl: "https://api.stepfun.com/step_plan/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("stepfun/step-3.5-flash", {
          id: "step-3.5-flash-2603",
          name: "Step 3.5 Flash 2603",
        }),
        piModel("stepfun/step-3.5-flash", {
          id: "step-3.5-flash",
        }),
        piModel("stepfun/step-3.7-flash", { id: "step-3.7-flash" }),
        piModel("stepfun/step-5-preview", { id: "step-5-preview" }),
      ],
    },
    category: "cn_official",
    icon: "stepfun",
    iconColor: "#16D6D2",
  },
  {
    name: "StepFun en",
    family: "stepfun",
    regionKey: "intl",
    providerKey: "cc-switch-step-fun-en",
    websiteUrl: "https://platform.stepfun.ai/step-plan",
    apiKeyUrl: "https://platform.stepfun.ai/interface-key",
    settingsConfig: {
      name: "StepFun en",
      baseUrl: "https://api.stepfun.ai/step_plan/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("stepfun/step-3.5-flash", {
          id: "step-3.5-flash-2603",
          name: "Step 3.5 Flash 2603",
        }),
        piModel("stepfun/step-3.5-flash", {
          id: "step-3.5-flash",
        }),
        piModel("stepfun/step-3.7-flash", { id: "step-3.7-flash" }),
        piModel("stepfun/step-5-preview", { id: "step-5-preview" }),
      ],
    },
    category: "cn_official",
    icon: "stepfun",
    iconColor: "#16D6D2",
  },
  {
    name: "StepFun Step Plan",
    providerKey: "cc-switch-step-fun-step-plan",
    websiteUrl: "https://platform.stepfun.com/docs/zh/step-plan/overview",
    apiKeyUrl: "https://platform.stepfun.com/interface-key",
    settingsConfig: {
      name: "StepFun Step Plan",
      baseUrl: "https://api.stepfun.com/step_plan/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("stepfun/step-3.5-flash", {
          id: "step-3.5-flash",
        }),
        piModel("stepfun/step-3.7-flash", { id: "step-3.7-flash" }),
        piModel("stepfun/step-5-preview", { id: "step-5-preview" }),
      ],
    },
    category: "cn_official",
    icon: "stepfun",
    iconColor: "#005AFF",
  },
  {
    name: "ModelScope",
    providerKey: "cc-switch-model-scope",
    websiteUrl: "https://modelscope.cn",
    apiKeyUrl: "https://modelscope.cn/my/myaccesstoken",
    settingsConfig: {
      name: "ModelScope",
      baseUrl: "https://api-inference.modelscope.cn/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("zai/glm-5.2", {
          id: "ZhipuAI/GLM-5.2",
        }),
      ],
    },
    category: "aggregator",
    icon: "modelscope",
    iconColor: "#624AFF",
  },
  {
    name: "StreamLake",
    family: "streamlake",
    regionKey: "cn",
    providerKey: "cc-switch-streamlake",
    websiteUrl: "https://www.streamlake.com",
    apiKeyUrl: "https://console.streamlake.com/console/wanqing/api-key",
    settingsConfig: {
      name: "StreamLake",
      baseUrl: "https://wanqing.streamlakeapi.com/api/gateway/v1/endpoints",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("streamlake/kat-coder-pro-v2.5", {
          id: "kat-coder-pro-v2.5",
        }),
      ],
    },
    category: "cn_official",
    icon: "streamlake",
  },
  {
    name: "StreamLake en",
    family: "streamlake",
    regionKey: "intl",
    providerKey: "cc-switch-kat-coder",
    websiteUrl: "https://console.streamlake.ai",
    apiKeyUrl: "https://console.streamlake.ai/console/api-key",
    settingsConfig: {
      name: "StreamLake en",
      baseUrl: "https://vanchin.streamlake.ai/api/gateway/v1/endpoints",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("streamlake/kat-coder-pro-v2.5", {
          id: "kat-coder-pro-v2.5",
        }),
      ],
    },
    category: "cn_official",
    icon: "streamlake",
  },
  {
    name: "Longcat",
    providerKey: "cc-switch-longcat",
    websiteUrl: "https://longcat.chat/platform",
    apiKeyUrl: "https://longcat.chat/platform/api_keys",
    settingsConfig: {
      name: "Longcat",
      baseUrl: "https://api.longcat.chat/openai/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("longcat/longcat-2.0", {
          id: "LongCat-2.0",
        }),
      ],
    },
    category: "cn_official",
    icon: "longcat",
    iconColor: "#29E154",
  },
  {
    name: "MiniMax",
    family: "minimax",
    regionKey: "cn",
    providerKey: "cc-switch-mini-max",
    websiteUrl: "https://platform.minimax.cn",
    apiKeyUrl: "https://platform.minimax.cn/subscribe/token-plan",
    settingsConfig: {
      name: "MiniMax",
      baseUrl: "https://api.minimax.cn/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("minimax/minimax-m3.1-flash", {
          id: "MiniMax-M3.1-Flash",
          maxTokens: 131072,
        }),
        piModel("minimax/minimax-m3", {
          id: "MiniMax-M3",
          maxTokens: 131072,
        }),
      ],
    },
    category: "cn_official",
    theme: {
      backgroundColor: "#f64551",
      textColor: "#FFFFFF",
    },
    icon: "minimax",
    iconColor: "#FF6B6B",
  },
  {
    name: "MiniMax en",
    family: "minimax",
    regionKey: "intl",
    providerKey: "cc-switch-mini-max-en",
    websiteUrl: "https://platform.minimax.io",
    apiKeyUrl: "https://platform.minimax.io/subscribe/coding-plan",
    settingsConfig: {
      name: "MiniMax en",
      baseUrl: "https://api.minimax.io/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("minimax/minimax-m3.1-flash", {
          id: "MiniMax-M3.1-Flash",
          maxTokens: 131072,
        }),
        piModel("minimax/minimax-m3", {
          id: "MiniMax-M3",
          maxTokens: 131072,
        }),
      ],
    },
    category: "cn_official",
    theme: {
      backgroundColor: "#f64551",
      textColor: "#FFFFFF",
    },
    icon: "minimax",
    iconColor: "#FF6B6B",
  },
  {
    name: "BaiLing",
    providerKey: "cc-switch-bai-ling",
    websiteUrl: "https://developer.ant-ling.com/zh-CN/docs/",
    apiKeyUrl: "https://chat.ant-ling.com/open",
    settingsConfig: {
      name: "BaiLing",
      baseUrl: "https://api.ant-ling.com/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("inclusionai/ling-2.6-1t", {
          id: "Ling-2.6-1T",
        }),
      ],
    },
    category: "cn_official",
    icon: "bailing",
  },
  {
    name: "Xiaomi MiMo",
    family: "xiaomi-mimo",
    planKey: "payg",
    providerKey: "cc-switch-xiaomi-mi-mo",
    websiteUrl: "https://platform.xiaomimimo.com",
    apiKeyUrl: "https://platform.xiaomimimo.com/#/console/api-keys",
    settingsConfig: {
      name: "Xiaomi MiMo",
      baseUrl: "https://api.xiaomimimo.com/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        {
          ...piModel("xiaomi/mimo-v2.6-pro", { id: "mimo-v2.6-pro" }),
          compat: XIAOMI_THINKING_COMPAT,
        },
        {
          ...piModel("xiaomi/mimo-v2.6-flash", { id: "mimo-v2.6-flash" }),
          compat: XIAOMI_THINKING_COMPAT,
        },
        {
          ...piModel("xiaomi/mimo-v2.6-pro-ultraspeed", {
            id: "mimo-v2.6-pro-ultraspeed",
          }),
          compat: XIAOMI_THINKING_COMPAT,
        },
      ],
    },
    category: "cn_official",
    icon: "xiaomimimo",
    iconColor: "#000000",
  },
  {
    name: "Xiaomi MiMo Token Plan (China)",
    family: "xiaomi-mimo",
    planKey: "tokenPlan",
    providerKey: "cc-switch-xiaomi-mi-mo-token-plan-china",
    websiteUrl: "https://platform.xiaomimimo.com/#/token-plan",
    apiKeyUrl: "https://platform.xiaomimimo.com/#/console/plan-manage",
    settingsConfig: {
      name: "Xiaomi MiMo Token Plan (China)",
      baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        {
          ...piModel("xiaomi/mimo-v2.6-pro", { id: "mimo-v2.6-pro" }),
          compat: XIAOMI_THINKING_COMPAT,
        },
        {
          ...piModel("xiaomi/mimo-v2.6-flash", { id: "mimo-v2.6-flash" }),
          compat: XIAOMI_THINKING_COMPAT,
        },
      ],
    },
    category: "cn_official",
    icon: "xiaomimimo",
    iconColor: "#000000",
  },
  {
    name: "AiHubMix",
    providerKey: "cc-switch-ai-hub-mix",
    websiteUrl: "https://aihubmix.com",
    apiKeyUrl: "https://aihubmix.com",
    settingsConfig: {
      name: "AiHubMix",
      baseUrl: "https://aihubmix.com",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("anthropic/claude-opus-5.5", {
          id: "claude-opus-5-5",
        }),
        piModel("anthropic/claude-sonnet-5.5", {
          id: "claude-sonnet-5-5",
        }),
        piModel("anthropic/claude-haiku-5.5", { id: "claude-haiku-5-5" }),
        piModel("anthropic/claude-fable-5.1", { id: "claude-fable-5-1" }),
      ],
    },
    category: "aggregator",
    icon: "aihubmix",
    iconColor: "#006FFB",
  },
  {
    name: "CherryIN",
    providerKey: "cc-switch-cherry-in",
    websiteUrl: "https://open.cherryin.ai",
    apiKeyUrl: "https://open.cherryin.ai/console/token",
    settingsConfig: {
      name: "CherryIN",
      baseUrl: "https://open.cherryin.net",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("anthropic/claude-opus-5.5", {
          id: "anthropic/claude-opus-5.5",
        }),
        piModel("anthropic/claude-sonnet-5.5", {
          id: "anthropic/claude-sonnet-5.5",
        }),
        piModel("anthropic/claude-fable-5.1", {
          id: "anthropic/claude-fable-5.1",
        }),
      ],
    },
    category: "aggregator",
    icon: "cherryin",
  },
  {
    name: "OpenRouter",
    providerKey: "cc-switch-open-router",
    websiteUrl: "https://openrouter.ai",
    apiKeyUrl: "https://openrouter.ai/keys",
    settingsConfig: {
      name: "OpenRouter",
      baseUrl: "https://openrouter.ai/api",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("anthropic/claude-opus-5.5", {
          id: "anthropic/claude-opus-5.5",
        }),
        piModel("anthropic/claude-sonnet-5.5", {
          id: "anthropic/claude-sonnet-5.5",
        }),
        piModel("anthropic/claude-haiku-5.5", {
          id: "anthropic/claude-haiku-5.5",
        }),
        piModel("anthropic/claude-fable-5.1", {
          id: "anthropic/claude-fable-5.1",
        }),
      ],
    },
    category: "aggregator",
    icon: "openrouter",
    iconColor: "#6566F1",
  },
  {
    name: "TheRouter",
    providerKey: "cc-switch-the-router",
    websiteUrl: "https://therouter.ai",
    apiKeyUrl: "https://dashboard.therouter.ai",
    settingsConfig: {
      name: "TheRouter",
      baseUrl: "https://api.therouter.ai/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("anthropic/claude-sonnet-5.5", {
          id: "anthropic/claude-sonnet-5-5",
        }),
        piModel("anthropic/claude-fable-5.1", {
          id: "anthropic/claude-fable-5-1",
        }),
        piModel("openai/gpt-6.1-sol", {
          id: "openai/gpt-6.1-sol",
        }),
        piModel("openai/gpt-6-astra", {
          id: "openai/gpt-6-astra",
        }),
        piModel("google/gemini-3.8-flash", {
          id: "google/gemini-3.8-flash",
        }),
        piModel("qwen/qwen3.8-max", {
          id: "qwen/qwen3.8-max",
        }),
      ],
    },
    category: "aggregator",
    icon: "therouter",
  },
  {
    name: "Baseten",
    // Pi 运行时内置了 baseten，用 cc-switch- 前缀避免同名遮蔽内置定义
    providerKey: "cc-switch-baseten",
    websiteUrl: "https://www.baseten.co",
    apiKeyUrl: "https://app.baseten.co/settings/api_keys",
    settingsConfig: {
      name: "Baseten",
      // 官方编程工具接入文档 Pi 直连 /v1 Chat（docs.baseten.co/inference/
      // model-apis/coding-agents，2026-10-14 核对）。窗口、最大输出与输入模态取
      // docs.baseten.co/development/model-apis/overview 同日模型表：目录里
      // glm-5.3 记为纯文本、131072，DeepSeek Flash 记为 1000000 / 384000，
      // 与平台声明不同，故覆盖
      baseUrl: "https://inference.baseten.co/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("zai/glm-5.3", {
          id: "zai-org/GLM-5.3",
          input: ["text", "image"],
          maxTokens: 262_144,
        }),
        piModel("moonshotai/kimi-k3", {
          id: "moonshotai/Kimi-K3",
          maxTokens: 262_144,
        }),
        piModel("zai/glm-5.3-flash", {
          id: "zai-org/GLM-5.3-Flash",
          maxTokens: 262_144,
        }),
        piModel("deepseek/deepseek-flash", {
          id: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
          name: "DeepSeek V4.1 Flash 1017",
          contextWindow: 1_048_576,
          maxTokens: 262_144,
        }),
        piModel("zai/glm-5.3", {
          id: "zai-org/GLM-5.3-Fast",
          name: "GLM-5.3 Fast",
          input: ["text", "image"],
          maxTokens: 262_144,
        }),
      ],
    },
    category: "aggregator",
    icon: "baseten",
  },
  {
    name: "Novita AI",
    providerKey: "cc-switch-novita-ai",
    websiteUrl: "https://novita.ai",
    apiKeyUrl: "https://novita.ai",
    settingsConfig: {
      name: "Novita AI",
      baseUrl: "https://api.novita.ai/openai",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("zai/glm-5.3", { id: "zai-org/glm-5.3" }),
        piModel("zai/glm-5.3-flash", { id: "zai-org/glm-5.3-flash" }),
        piModel("moonshotai/kimi-k3.1-pro", { id: "moonshotai/kimi-k3.1-pro" }),
        piModel("deepseek/deepseek-flash", {
          id: "deepseek/deepseek-v4.1-flash",
        }),
        piModel("minimax/minimax-m3.1-flash", {
          id: "minimax/minimax-m3.1-flash",
        }),
        piModel("qwen/qwen3.8-max", { id: "qwen/qwen3.8-max" }),
        piModel("xiaomi/mimo-v2.6-pro", { id: "xiaomimimo/mimo-v2.6-pro" }),
      ],
    },
    category: "aggregator",
    icon: "novita",
    iconColor: "#000000",
  },
  {
    name: "Nvidia",
    providerKey: "cc-switch-nvidia",
    websiteUrl: "https://build.nvidia.com",
    apiKeyUrl: "https://build.nvidia.com/settings/api-keys",
    settingsConfig: {
      name: "Nvidia",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("moonshotai/kimi-k2.6", {
          id: "moonshotai/kimi-k2.6",
        }),
        piModel("zai/glm-5.3", { id: "z-ai/glm-5.3" }),
        piModel("zai/glm-5.3-flash", { id: "z-ai/glm-5.3-flash" }),
      ],
    },
    category: "aggregator",
    icon: "nvidia",
    iconColor: "#000000",
  },
  {
    // Pi 运行时没有内置 Ollama provider（pi-mono models.generated.ts 搜不到），
    // 不违反「勿写内置节点」契约
    name: "Ollama Cloud",
    providerKey: "cc-switch-ollama-cloud",
    websiteUrl: "https://ollama.com",
    apiKeyUrl: "https://ollama.com/settings/keys",
    settingsConfig: {
      name: "Ollama Cloud",
      // 云端 OpenAI 兼容 base（docs.ollama.com/api/openai-compatibility，
      // 2026-10-14 核对）；窗口取 https://ollama.com/api/show
      baseUrl: "https://ollama.com/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("zai/glm-5.3", { id: "glm-5.3" }),
        piModel("zai/glm-5.3-flash", { id: "glm-5.3-flash" }),
        piModel("moonshotai/kimi-k3", { id: "kimi-k3" }),
        piModel("deepseek/deepseek-v4-pro", {
          id: "deepseek-v4-pro:0813",
          contextWindow: 1_048_576,
        }),
        // 目录默认 1M，Ollama 云端只开 512K，必须覆盖
        piModel("minimax/minimax-m3", {
          id: "minimax-m3",
          contextWindow: 512_000,
        }),
      ],
    },
    category: "cloud_provider",
    icon: "ollama",
  },
  {
    // Pi 运行时没有内置本机 Ollama provider，Pi 文档自己就用 models.json 写它
    name: "Ollama",
    providerKey: "cc-switch-ollama",
    websiteUrl: "https://ollama.com",
    settingsConfig: {
      name: "Ollama",
      // Pi 文档（pi-mono packages/coding-agent/docs/models.md，2026-10-14
      // 核对）的本机写法：openai-completions + http://localhost:11434/v1。
      // 服务端不校验 Key，但 Pi 文档说要填一个占位 Key 模型才会出现在列表里，
      // 添加后手填 ollama。模型换成自己已下载的
      baseUrl: "http://localhost:11434/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("qwen/qwen3.5", { id: "qwen3.5" }),
        piModel("openai/gpt-oss-20b", { id: "gpt-oss:20b" }),
      ],
    },
    category: "local",
    icon: "ollama",
  },
  {
    // Pi 运行时没有内置 LM Studio provider（pi-mono models.generated.ts 搜不到），
    // Pi 文档自己就用 models.json 写它，不违反「勿写内置节点」契约
    name: "LM Studio",
    providerKey: "cc-switch-lmstudio",
    websiteUrl: "https://lmstudio.ai",
    settingsConfig: {
      name: "LM Studio",
      // 本机 OpenAI Chat base http://localhost:1234/v1（lmstudio.ai/docs/
      // developer/openai-compat、pi-mono packages/coding-agent/docs/models.md，
      // 2026-10-14 核对）。默认不鉴权，但 Pi 要填一个占位 Key 模型才会出现在
      // 列表里，添加后手填 lmstudio。Chat 上的 reasoning_effort 未证实，同 Groq
      // 先例不写 thinkingProfile，compat 按通用 OpenAI Completions 写；最大输出
      // 取 models.dev 的 lmstudio 条目（目录里的 65536 来自 Groq）。模型换成
      // 自己已下载的；实际窗口受 LM Studio 加载时的 context length 限制
      baseUrl: "http://localhost:1234/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        {
          ...piModel("openai/gpt-oss-20b", {
            id: "openai/gpt-oss-20b",
            maxTokens: 32_768,
          }),
          compat: { ...OPENAI_COMPLETIONS_COMPAT },
        },
      ],
    },
    category: "local",
    icon: "lmstudio",
  },
  {
    // Pi 运行时没有内置 vLLM provider（pi-mono models.generated.ts 搜不到），
    // Pi 文档把 vLLM 列为用 models.json 配置兼容端点的场景，不违反「勿写内置
    // 节点」契约
    name: "vLLM",
    providerKey: "cc-switch-vllm",
    websiteUrl: "https://vllm.ai",
    settingsConfig: {
      name: "vLLM",
      // 本机 vllm serve 的 OpenAI Chat base http://localhost:8000/v1
      //（docs.vllm.ai/en/latest/serving/online_serving/openai_compatible_server、
      // pi-mono packages/coding-agent/docs/models.md，2026-10-14 核对）。不带
      // --api-key 时不校验，但 Pi 要填一个非空占位 Key 模型才会出现在列表里，
      // 添加后手填 dummy（带了 --api-key 就填那个值）。工具调用要启动时加
      // --enable-auto-tool-choice --tool-call-parser qwen3_coder。档位映射没有
      // 逐模型证据，不写 thinkingProfile。默认模型须与 /v1/models 的 id 一致，
      // 换成自己已下载的；实际窗口受 --max-model-len 限制
      baseUrl: "http://localhost:8000/v1",
      api: "openai-completions",
      apiKey: "",
      models: [piModel("qwen/qwen3.6-27b", { id: "Qwen/Qwen3.6-27B" })],
    },
    category: "local",
    icon: "vllm",
  },
  {
    name: "Meta Model API",
    providerKey: "cc-switch-meta",
    websiteUrl: "https://dev.meta.ai",
    apiKeyUrl: "https://dev.meta.ai",
    settingsConfig: {
      name: "Meta Model API",
      // OpenAI Chat 端点 /v1/chat/completions（dev.meta.ai/docs/coding-agents.md，
      // 2026-10-14 核对），Bearer 鉴权。两款常开思考（none 返回 400），关闭档
      // 隐藏；xhigh/max 原样发（dev.meta.ai/docs/reasoning.md）。Chat 参数表只
      // 列到 xhigh，max 是否被 Chat 接受未实测
      baseUrl: "https://api.meta.ai/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("meta/muse-wonder-1.0", {
          id: "muse-wonder-1.0",
          thinkingProfile: "offUnsupportedXhighAndMax",
        }),
        piModel("meta/muse-spark-1.3", {
          id: "muse-spark-1.3",
          thinkingProfile: "offUnsupportedXhighAndMax",
        }),
      ],
    },
    category: "cn_official",
    icon: "meta",
  },
  {
    name: "DeepInfra",
    providerKey: "cc-switch-deepinfra",
    websiteUrl: "https://deepinfra.com",
    apiKeyUrl: "https://deepinfra.com/dash/api_keys",
    settingsConfig: {
      name: "DeepInfra",
      // 官方 Pi 接入文档（docs.deepinfra.com/integrations/pi.md，2026-10-14
      // 核对）：Pi 未内置 DeepInfra，base 为 /v1/openai Chat。DeepSeek 两款须带
      // supportsDeveloperRole: false（否则 developer 角色报 422）与
      // thinkingFormat: "deepseek"，其余模型不加。目录里没有带日期的 DeepSeek
      // key，用不带日期的条目覆盖 id；窗口取 https://api.deepinfra.com/models/<id>
      // 同日元数据，GLM-5.2 最大输出按平台 163840 覆盖
      baseUrl: "https://api.deepinfra.com/v1/openai",
      api: "openai-completions",
      apiKey: "",
      models: [
        {
          ...piModel("deepseek/deepseek-v4-flash", {
            id: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
            name: "DeepSeek V4.1 Flash 1017",
            contextWindow: 1_048_576,
            thinkingProfile: "deepseekV4",
          }),
          compat: { supportsDeveloperRole: false, thinkingFormat: "deepseek" },
        },
        {
          ...piModel("deepseek/deepseek-v4-pro", {
            id: "deepseek-ai/DeepSeek-V4-Pro-0813",
            name: "DeepSeek V4 Pro 0813",
            contextWindow: 1_048_576,
            thinkingProfile: "deepseekV4",
          }),
          compat: { supportsDeveloperRole: false, thinkingFormat: "deepseek" },
        },
        // KIMI_K3_COMPAT 是 Moonshot 官方端点的口径，DeepInfra 未证实，不抄
        piModel("moonshotai/kimi-k3", {
          id: "moonshotai/Kimi-K3",
          thinkingProfile: "kimi3",
        }),
        piModel("zai/glm-5.3", { id: "zai-org/GLM-5.3" }),
        piModel("zai/glm-5.3-flash", { id: "zai-org/GLM-5.3-Flash" }),
      ],
    },
    category: "aggregator",
    icon: "deepinfra",
  },
  {
    name: "Vercel AI Gateway",
    // vercel-ai-gateway 是 Pi 内置供应商 ID，同名节点会遮蔽内置定义，故加前缀
    providerKey: "cc-switch-vercel-ai-gateway",
    websiteUrl: "https://vercel.com/ai-gateway",
    apiKeyUrl:
      "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway%2Fapi-keys",
    settingsConfig: {
      name: "Vercel AI Gateway",
      // 走 /coding-agent/v1 Chat（vercel.com/docs/ai-gateway/coding-agents/pi 与
      // vercel.com/docs/cli/ai-gateway，2026-10-14 核对）。Gemini 3.8 Flash 按
      // GET https://ai-gateway.vercel.sh/v1/models 同日元数据覆盖窗口与最大输出；
      // GPT 按 API 计费、窗口 1.05M，不用 catalog 的订阅窗口；Haiku 5.5、GPT-6.1 Sol 目录里还没有条目，暂不收
      baseUrl: "https://ai-gateway.vercel.sh/coding-agent/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("anthropic/claude-opus-5.5", {
          id: "anthropic/claude-opus-5.5",
        }),
        piModel("anthropic/claude-sonnet-5.5", {
          id: "anthropic/claude-sonnet-5.5",
        }),
        piModel("anthropic/claude-fable-5.1", {
          id: "anthropic/claude-fable-5.1",
        }),
        piModel("openai/gpt-6-astra", {
          id: "openai/gpt-6-astra",
          contextWindow: 1_050_000,
        }),
        piModel("openai/gpt-6-luna", {
          id: "openai/gpt-6-luna",
          contextWindow: 1_050_000,
        }),
        piModel("google/gemini-3.8-flash", {
          id: "google/gemini-3.8-flash",
          contextWindow: 1_000_000,
          maxTokens: 65_535,
        }),
      ],
    },
    category: "aggregator",
    icon: "vercel",
  },
  {
    name: "Nebius Token Factory",
    // models.dev 已有 nebius 供应商，加前缀以免撞上可能的内置同名 ID
    providerKey: "cc-switch-nebius-token-factory",
    websiteUrl: "https://nebius.com/token-factory",
    apiKeyUrl: "https://tokenfactory.nebius.com/project/api-keys",
    settingsConfig: {
      name: "Nebius Token Factory",
      // OpenAI Chat 端点 base 为 /v1（docs.tokenfactory.nebius.com/switch.md，
      // 2026-10-14 核对）。窗口与模态按官方公开目录
      // tokenfactory.nebius.com/api/public/models_info 同日快照覆盖；同 Novita /
      // Nvidia，聚合平台不假定厂商私有参数，不写 thinkingProfile / compat
      baseUrl: "https://api.tokenfactory.nebius.com/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("zai/glm-5.3", {
          id: "zai-org/GLM-5.3",
          contextWindow: 1_024_000,
        }),
        piModel("zai/glm-5.3-flash", {
          id: "zai-org/GLM-5.3-Flash",
          contextWindow: 1_024_000,
        }),
        piModel("moonshotai/kimi-k3", {
          id: "moonshotai/Kimi-K3",
          contextWindow: 1_024_000,
        }),
        piModel("deepseek/deepseek-flash", {
          id: "deepseek-ai/DeepSeek-V4.1-Flash",
        }),
        piModel("minimax/minimax-m3", { id: "MiniMaxAI/MiniMax-M3" }),
        piModel("minimax/minimax-m3.1-flash", {
          id: "MiniMaxAI/MiniMax-M3.1-Flash",
        }),
        piModel("moonshotai/kimi-k2.7-code", {
          id: "moonshotai/Kimi-K2.7-Code",
          input: ["text"],
        }),
        piModel("deepseek/deepseek-v4-pro", {
          id: "deepseek-ai/DeepSeek-V4-Pro-0813",
          name: "DeepSeek V4 Pro 0813",
          contextWindow: 979_000,
        }),
      ],
    },
    category: "aggregator",
    icon: "nebius",
  },
  {
    name: "Groq",
    // Pi 是否内置 groq provider 未证实，加前缀两种情况都不会遮蔽内置定义
    providerKey: "cc-switch-groq",
    websiteUrl: "https://groq.com",
    apiKeyUrl: "https://console.groq.com/keys",
    settingsConfig: {
      name: "Groq",
      // OpenAI Chat 端点 base 为 /openai/v1（console.groq.com/docs/openai，
      // 2026-10-14 核对），只收自助可用的 Production 模型 gpt-oss 两款。Groq
      // 是否接受 developer role / store 未证实，compat 按保守的通用 OpenAI
      // Completions 写；同 Novita / Nvidia，不写 thinkingProfile
      baseUrl: "https://api.groq.com/openai/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        {
          ...piModel("openai/gpt-oss-120b", { id: "openai/gpt-oss-120b" }),
          compat: { ...OPENAI_COMPLETIONS_COMPAT },
        },
        {
          ...piModel("openai/gpt-oss-20b", { id: "openai/gpt-oss-20b" }),
          compat: { ...OPENAI_COMPLETIONS_COMPAT },
        },
      ],
    },
    category: "aggregator",
    icon: "groq",
  },
  {
    name: "SambaNova",
    providerKey: "cc-switch-sambanova",
    websiteUrl: "https://sambanova.ai",
    apiKeyUrl: "https://cloud.sambanova.ai/apis",
    settingsConfig: {
      name: "SambaNova",
      // OpenAI Chat 端点 base 为 /v1（docs.sambanova.ai/docs/en/integrations/
      // opencode，2026-10-14 核对）。OpenAPI 的 Chat 请求没有 developer 角色与
      // store 字段，compat 按通用 OpenAI Completions 写。MiniMax-M3 在 SambaCloud
      // 上只收文字，须覆盖 catalog 的 text+image；窗口取公开 /v1/models 同日值，
      // maxTokens 同 MiniMax en 预设写 131072，不写 thinkingProfile。gpt-oss-120b
      // 的 reasoning_effort 枚举为 low/medium/high（OpenAPI 声明）
      baseUrl: "https://api.sambanova.ai/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        {
          ...piModel("minimax/minimax-m3", {
            id: "MiniMax-M3",
            input: ["text"],
            contextWindow: 1048576,
            maxTokens: 131072,
          }),
          compat: { ...OPENAI_COMPLETIONS_COMPAT },
        },
        {
          ...piModel("openai/gpt-oss-120b", {
            id: "gpt-oss-120b",
            thinkingProfile: "lowMediumHighOnly",
          }),
          compat: { ...OPENAI_COMPLETIONS_COMPAT },
        },
      ],
    },
    category: "cloud_provider",
    icon: "sambanova",
  },
  {
    name: "DigitalOcean",
    providerKey: "cc-switch-digitalocean",
    websiteUrl: "https://www.digitalocean.com/products/ai-platform",
    apiKeyUrl: "https://cloud.digitalocean.com/model-studio/manage-keys",
    settingsConfig: {
      name: "DigitalOcean",
      // OpenAI Chat 端点 base 为 /v1（docs.digitalocean.com/products/inference/
      // how-to/use-with-coding-agents，2026-10-14 核对），Bearer 鉴权，不加
      // compat（同 Novita 等聚合平台）。Pi 内置供应商里没有 DigitalOcean。
      // catalog 没有 V4 Pro 0813，借 V4 Pro 的能力值。Sonnet 5.5 须 Tier 3+
      // 账号，首行用所有等级可用的 GLM-5.3
      baseUrl: "https://inference.do-ai.run/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("zai/glm-5.3", { id: "glm-5.3" }),
        piModel("moonshotai/kimi-k3", { id: "kimi-k3" }),
        piModel("deepseek/deepseek-v4-pro", { id: "deepseek-v4-pro-0813" }),
        piModel("anthropic/claude-sonnet-5.5", {
          id: "anthropic-claude-sonnet-5.5",
        }),
      ],
    },
    category: "cloud_provider",
    icon: "digitalocean",
  },
  {
    name: "Hugging Face",
    // Pi 运行时内置了 huggingface，用 cc-switch- 前缀避免同名遮蔽内置定义
    providerKey: "cc-switch-hugging-face",
    websiteUrl: "https://huggingface.co/inference/models",
    apiKeyUrl:
      "https://huggingface.co/settings/tokens/new?ownUserPermissions=inference.serverless.write&tokenType=fineGrained",
    settingsConfig: {
      name: "Hugging Face",
      // OpenAI Chat 端点 base 为 https://router.huggingface.co/v1
      //（huggingface.co/docs/inference-providers/integrations/pi，2026-10-14
      // 核对），Bearer 鉴权，不加 compat（同 Novita 等聚合平台）。上游钉
      // :baseten（同 Claude Code 预设）；公开 /v1/models 对 Baseten 的同日声明
      // 窗口均为 1048576，目录里 V4 Pro 记为 1000000，故覆盖。catalog 没有
      // V4 Pro 0813，借 V4 Pro 的能力值
      baseUrl: "https://router.huggingface.co/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("zai/glm-5.3", { id: "zai-org/GLM-5.3:baseten" }),
        piModel("zai/glm-5.3-flash", { id: "zai-org/GLM-5.3-Flash:baseten" }),
        piModel("moonshotai/kimi-k3", { id: "moonshotai/Kimi-K3:baseten" }),
        piModel("deepseek/deepseek-flash", {
          id: "deepseek-ai/DeepSeek-V4.1-Flash-1017:baseten",
          name: "DeepSeek V4.1 Flash 1017",
          contextWindow: 1_048_576,
          maxTokens: 262_144,
        }),
        piModel("deepseek/deepseek-v4-pro", {
          id: "deepseek-ai/DeepSeek-V4-Pro-0813:baseten",
          contextWindow: 1_048_576,
        }),
      ],
    },
    category: "aggregator",
    icon: "huggingface",
  },
  {
    name: "Microsoft Foundry",
    providerKey: "cc-switch-microsoft-foundry",
    websiteUrl: "https://azure.microsoft.com/en-us/products/ai-foundry",
    apiKeyUrl: "https://ai.azure.com/",
    settingsConfig: {
      name: "Microsoft Foundry",
      // 同 Claude Code 预设：Anthropic 端点 base 为 https://<资源名>.services.ai.azure.com/
      // anthropic、不带 /v1，API Key 发 x-api-key（learn.microsoft.com/en-us/azure/
      // foundry/foundry-models/how-to/use-foundry-models-claude，2026-10-14 核对）；
      // pi-ai 对普通 Key 走 Anthropic SDK 的 apiKey，发的正是 x-api-key。Pi 内置的
      // azure-openai-responses 只管 GPT，Claude 须自定义节点。资源名用字面占位符；
      // 模型 ID 填默认部署名，自定义了须同步改。Haiku 5.5 为 1M / 128K、支持思考
      //（learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/
      // claude-models 同日），目录里原先没有，已补
      baseUrl: "https://YOUR_RESOURCE_NAME.services.ai.azure.com/anthropic",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("anthropic/claude-opus-5.5", { id: "claude-opus-5-5" }),
        piModel("anthropic/claude-sonnet-5.5", { id: "claude-sonnet-5-5" }),
        piModel("anthropic/claude-haiku-5.5", { id: "claude-haiku-5-5" }),
      ],
    },
    category: "cloud_provider",
    icon: "azure",
    iconColor: "#0078D4",
  },
  {
    name: "PIPELLM",
    providerKey: "cc-switch-pipellm",
    websiteUrl: "https://code.pipellm.ai",
    apiKeyUrl: "https://code.pipellm.ai/login?ref=uvw650za",
    settingsConfig: {
      name: "PIPELLM",
      baseUrl: "https://cc-api.pipellm.ai",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("anthropic/claude-opus-5.5", {
          id: "claude-opus-5-5",
          name: "claude-opus-5",
        }),
        piModel("anthropic/claude-sonnet-5.5", {
          id: "claude-sonnet-5-5",
          name: "claude-sonnet-5",
        }),
        piModel("anthropic/claude-haiku-5.5", {
          id: "claude-haiku-5-5",
          name: "claude-haiku-4-5-20251001",
        }),
      ],
    },
    category: "aggregator",
    icon: "pipellm",
  },
  {
    name: "AICodeWith",
    providerKey: "cc-switch-aicode-with",
    websiteUrl: "https://aicodewith.ai",
    apiKeyUrl: "https://aicodewith.ai/login?tab=register",
    settingsConfig: {
      name: "AICodeWith",
      baseUrl: "https://api.aicodewith.ai/v1",
      api: "openai-responses",
      apiKey: "",
      models: [
        piModel("openai/gpt-6.1-sol", {
          id: "gpt-6.1-sol",
          name: "gpt-5.6-sol",
        }),
        piModel("openai/gpt-6-sol", { id: "gpt-6-sol" }),
        piModel("openai/gpt-6-astra", { id: "gpt-6-astra" }),
      ],
    },
    category: "aggregator",
    icon: "aicodewith",
    iconColor: "#3A3B40",
  },
  {
    name: "E-FlowCode",
    providerKey: "cc-switch-e-flow-code",
    websiteUrl: "https://e-flowcode.cc",
    apiKeyUrl: "https://e-flowcode.cc",
    settingsConfig: {
      name: "E-FlowCode",
      baseUrl: "https://e-flowcode.cc/v1",
      api: "openai-responses",
      apiKey: "",
      models: [
        piModel("openai/gpt-6.1-sol", {
          id: "gpt-6.1-sol",
          name: "gpt-5.2-codex",
        }),
        piModel("openai/gpt-6-sol", { id: "gpt-6-sol" }),
        piModel("openai/gpt-6-astra", {
          id: "gpt-6-astra",
          name: "gpt-5.3-codex",
        }),
      ],
    },
    category: "third_party",
    icon: "eflowcode",
    iconColor: "#000000",
  },
  {
    name: "AWS Bedrock",
    providerKey: "cc-switch-aws-bedrock",
    websiteUrl: "https://aws.amazon.com/bedrock/",
    settingsConfig: {
      name: "AWS Bedrock",
      baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
      api: "bedrock-converse-stream",
      apiKey: "",
      models: [
        piModel("anthropic/claude-opus-5", {
          id: "global.anthropic.claude-opus-5",
          thinkingProfile: "xhighAndMax",
        }),
        piModel("anthropic/claude-sonnet-5", {
          id: "global.anthropic.claude-sonnet-5",
          thinkingProfile: "xhighAndMax",
        }),
        piModel("anthropic/claude-haiku-4.5-20251001", {
          id: "global.anthropic.claude-haiku-4-5-20251001-v1:0",
        }),
        piModel("amazon/nova-pro", {
          id: "us.amazon.nova-pro-v1:0",
        }),
        piModel("meta/llama-4-maverick", {
          id: "us.meta.llama4-maverick-17b-instruct-v1:0",
        }),
        piModel("deepseek/deepseek-r1", {
          id: "us.deepseek.r1-v1:0",
        }),
      ],
    },
    category: "cloud_provider",
    icon: "aws",
    iconColor: "#FF9900",
  },
  // ===== 腾讯云 Token Plan（订阅套餐，产品线 1823/1300）=====
  // 与 claude/codex/opencode/hermes/openclaw 六 app 的腾讯预设同源：
  // 个人版国内走 api.lkeap.cloud.tencent.com/plan，其余走 tencentmaas.com/plan
  // 域族；两站 Key 不互通，双地域候选（国内→新加坡、国际→广州）仅在企业
  // 套餐存在。Pi 预设只携带默认地域 baseUrl（PiProviderPreset 无
  // endpointCandidates 字段），需要第二地域的用户在 UI 中手动改 baseUrl。
  {
    name: "Tencent Token Plan",
    family: "tencent",
    planKey: "tokenPlan",
    regionKey: "cn",
    providerKey: "cc-switch-tencent-token-plan",
    websiteUrl: "https://cloud.tencent.com/product/tokenhub",
    apiKeyUrl: "https://console.cloud.tencent.com/tokenhub/tokenplan",
    settingsConfig: {
      name: "Tencent Token Plan",
      baseUrl: "https://api.lkeap.cloud.tencent.com/plan/v3",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("tencent/tokenplan-auto", { id: "tc-code-latest" }),
        {
          ...piModel("deepseek/deepseek-v4-flash", {
            id: "deepseek-v4-flash-202605",
            name: "DeepSeek V4 Flash Official",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-pro", {
            id: "deepseek-v4-pro-202606",
            name: "DeepSeek V4 Pro Official",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        piModel("minimax/minimax-m2.7", { id: "minimax-m2.7" }),
        piModel("zai/glm-5", { id: "glm-5" }),
        piModel("zai/glm-5.1", { id: "glm-5.1" }),
        piModel("zai/glm-5.2", { id: "glm-5.2" }),
        piModel("tencent/hy3", { id: "hy3" }),
        piModel("tencent/hy3-preview", { id: "hy3-preview" }),
      ],
    },
    category: "cn_official",
    icon: "tencent",
    iconColor: "#00A4FF",
  },
  {
    name: "Tencent Token Plan (Intl)",
    family: "tencent",
    planKey: "tokenPlan",
    regionKey: "intl",
    providerKey: "cc-switch-tencent-token-plan-intl",
    websiteUrl: "https://www.tencentcloud.com/products/tokenhub",
    apiKeyUrl: "https://console.tencentcloud.com/tokenhub/tokenplan",
    settingsConfig: {
      name: "Tencent Token Plan (Intl)",
      baseUrl: "https://tokenhub-intl.tencentcloudmaas.com/plan/v3",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("tencent/tokenplan-auto", { id: "auto" }),
        piModel("zai/glm-5.2", { id: "glm-5.2" }),
        piModel("moonshotai/kimi-k2.6", { id: "kimi-k2.6" }),
        {
          ...piModel("deepseek/deepseek-v4-pro", {
            id: "deepseek-v4-pro-202606",
            name: "DeepSeek V4 Pro Official",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-flash", {
            id: "deepseek-v4-flash-202605",
            name: "DeepSeek V4 Flash Official",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        piModel("minimax/minimax-m3", { id: "minimax-m3" }),
      ],
    },
    category: "cn_official",
    icon: "tencent",
    iconColor: "#00A4FF",
  },
  {
    name: "Tencent Token Plan Enterprise Pro",
    family: "tencent",
    planKey: "enterprisePro",
    regionKey: "cn",
    providerKey: "cc-switch-tencent-token-plan-enterprise-pro",
    websiteUrl: "https://cloud.tencent.com/product/tokenhub",
    apiKeyUrl: "https://console.cloud.tencent.com/tokenhub/tokenplan-e",
    settingsConfig: {
      name: "Tencent Token Plan Enterprise Pro",
      baseUrl: "https://tokenhub.tencentmaas.com/plan/v3",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("tencent/tokenplan-auto", { id: "auto" }),
        piModel("zai/glm-5.3", { id: "glm-5.3" }),
        piModel("zai/glm-5.2", { id: "glm-5.2" }),
        piModel("zai/glm-5", { id: "glm-5" }),
        piModel("zai/glm-5.1", { id: "glm-5.1" }),
        piModel("zai/glm-5-turbo", { id: "glm-5-turbo" }),
        piModel("moonshotai/kimi-k2.7-code", {
          id: "kimi-k2.7-code",
          thinkingProfile: "offUnsupported",
        }),
        piModel("moonshotai/kimi-k2.7-code-highspeed", {
          id: "kimi-k2.7-code-highspeed",
          thinkingProfile: "offUnsupported",
        }),
        piModel("moonshotai/kimi-k2.6", { id: "kimi-k2.6" }),
        piModel("minimax/minimax-m3", { id: "minimax-m3" }),
        {
          ...piModel("deepseek/deepseek-v4-flash", {
            id: "deepseek-v4-flash",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-pro", {
            id: "deepseek-v4-pro",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-flash", {
            id: "deepseek-v4-flash-0731",
            name: "DeepSeek V4 Flash 0731 GA",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-pro", {
            id: "deepseek-v4-pro-0813",
            name: "DeepSeek V4 Pro 0813 GA",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-flash", {
            id: "deepseek-v4-flash-202605",
            name: "DeepSeek V4 Flash Official",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-pro", {
            id: "deepseek-v4-pro-202606",
            name: "DeepSeek V4 Pro Official",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
      ],
    },
    category: "cn_official",
    icon: "tencent",
    iconColor: "#00A4FF",
  },
  {
    name: "Tencent Token Plan Enterprise Pro (Intl)",
    family: "tencent",
    planKey: "enterprisePro",
    regionKey: "intl",
    providerKey: "cc-switch-tencent-token-plan-enterprise-pro-intl",
    websiteUrl: "https://www.tencentcloud.com/products/tokenhub",
    apiKeyUrl: "https://console.tencentcloud.com/tokenhub/tokenplan-e",
    settingsConfig: {
      name: "Tencent Token Plan Enterprise Pro (Intl)",
      baseUrl: "https://tokenhub-intl.tencentcloudmaas.com/plan/v3",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("tencent/tokenplan-auto", { id: "auto" }),
        piModel("zai/glm-5.3", { id: "glm-5.3" }),
        piModel("zai/glm-5.2", { id: "glm-5.2" }),
        piModel("minimax/minimax-m3", { id: "minimax-m3" }),
        piModel("moonshotai/kimi-k2.7-code", {
          id: "kimi-k2.7-code",
          thinkingProfile: "offUnsupported",
        }),
        piModel("moonshotai/kimi-k2.7-code-highspeed", {
          id: "kimi-k2.7-code-highspeed",
          thinkingProfile: "offUnsupported",
        }),
        {
          ...piModel("deepseek/deepseek-v4-flash", {
            id: "deepseek-v4-flash",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-pro", {
            id: "deepseek-v4-pro",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-flash", {
            id: "deepseek-v4-flash-0731",
            name: "DeepSeek V4 Flash 0731 GA",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-pro", {
            id: "deepseek-v4-pro-0813",
            name: "DeepSeek V4 Pro 0813 GA",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-flash", {
            id: "deepseek-v4-flash-202605",
            name: "DeepSeek V4 Flash Official",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-pro", {
            id: "deepseek-v4-pro-202606",
            name: "DeepSeek V4 Pro Official",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
      ],
    },
    category: "cn_official",
    icon: "tencent",
    iconColor: "#00A4FF",
  },
  {
    name: "Tencent Token Plan Enterprise Lite",
    family: "tencent",
    planKey: "enterpriseLite",
    regionKey: "cn",
    providerKey: "cc-switch-tencent-token-plan-enterprise-lite",
    websiteUrl: "https://cloud.tencent.com/product/tokenhub",
    apiKeyUrl: "https://console.cloud.tencent.com/tokenhub/tokenplan-e",
    settingsConfig: {
      name: "Tencent Token Plan Enterprise Lite",
      baseUrl: "https://tokenhub.tencentmaas.com/plan/v3",
      api: "openai-completions",
      apiKey: "",
      models: [piModel("tencent/tokenplan-auto", { id: "auto" })],
    },
    category: "cn_official",
    icon: "tencent",
    iconColor: "#00A4FF",
  },
  {
    name: "Tencent Token Plan Enterprise Lite (Intl)",
    family: "tencent",
    planKey: "enterpriseLite",
    regionKey: "intl",
    providerKey: "cc-switch-tencent-token-plan-enterprise-lite-intl",
    websiteUrl: "https://www.tencentcloud.com/products/tokenhub",
    apiKeyUrl: "https://console.tencentcloud.com/tokenhub/tokenplan-e",
    settingsConfig: {
      name: "Tencent Token Plan Enterprise Lite (Intl)",
      baseUrl: "https://tokenhub-intl.tencentcloudmaas.com/plan/v3",
      api: "openai-completions",
      apiKey: "",
      models: [piModel("tencent/tokenplan-auto", { id: "auto" })],
    },
    category: "cn_official",
    icon: "tencent",
    iconColor: "#00A4FF",
  },
  // ===== 腾讯云 TokenHub（按量付费 API 市场，产品线 1823/1300，/v1 端点）=====
  // 与 Token Plan 订阅线（/plan 端点）是两条独立产品线：Key 不互通、端点不同。
  // 模型清单取自官方「语言模型」列表（国内 130051 / 国际 78934），只收录支持
  // Function Calling 的通用语言模型；翻译（hy-mt2）、角色扮演（hy-role）等
  // 专用模型不收录（无法用于编码 agent）。
  {
    name: "Tencent TokenHub",
    family: "tencent",
    planKey: "payg",
    regionKey: "cn",
    providerKey: "cc-switch-tencent-tokenhub",
    websiteUrl: "https://cloud.tencent.com/product/tokenhub",
    apiKeyUrl: "https://console.cloud.tencent.com/tokenhub/apikey",
    settingsConfig: {
      name: "Tencent TokenHub",
      baseUrl: "https://tokenhub.tencentmaas.com/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("tencent/hy4-preview", { id: "hy4-preview" }),
        piModel("tencent/hy3", { id: "hy3" }),
        {
          ...piModel("deepseek/deepseek-v4-flash", {
            id: "deepseek-v4-flash-202605",
            name: "DeepSeek V4 Flash Official",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-pro", {
            id: "deepseek-v4-pro-202606",
            name: "DeepSeek V4 Pro Official",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-flash-vision-exp", {
            id: "deepseek/deepseek-v4-flash-vision-exp",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-flash", {
            id: "deepseek-v4-flash-0731",
            name: "DeepSeek V4 Flash 0731 GA",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-pro", {
            id: "deepseek-v4-pro-0813",
            name: "DeepSeek V4 Pro 0813 GA",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-flash", {
            id: "deepseek-v4-flash",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-pro", {
            id: "deepseek-v4-pro",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        piModel("zai/glm-5.3-flash", { id: "glm-5.3-flash" }),
        piModel("zai/glm-5.3", { id: "glm-5.3" }),
        piModel("zai/glm-5.2", { id: "glm-5.2" }),
        piModel("zai/glm-5.1", { id: "glm-5.1" }),
        piModel("zai/glm-5v-turbo", { id: "glm-5v-turbo" }),
        piModel("zai/glm-5-turbo", { id: "glm-5-turbo" }),
        piModel("zai/glm-5", { id: "glm-5" }),
        piModel("moonshotai/kimi-k2.7-code-highspeed", {
          id: "kimi-k2.7-code-highspeed",
          thinkingProfile: "offUnsupported",
        }),
        piModel("moonshotai/kimi-k3", { id: "kimi-k3" }),
        piModel("moonshotai/kimi-k2.7-code", {
          id: "kimi-k2.7-code",
          thinkingProfile: "offUnsupported",
        }),
        piModel("moonshotai/kimi-k2.6", { id: "kimi-k2.6" }),
        piModel("moonshotai/kimi-k2.5", { id: "kimi-k2.5" }),
        piModel("minimax/minimax-m3", { id: "minimax-m3" }),
        piModel("minimax/minimax-m2.7", { id: "minimax-m2.7" }),
        piModel("xiaomi/mimo-v2.5-pro", { id: "mimo-v2.5-pro" }),
      ],
    },
    category: "cn_official",
    icon: "tencent",
    iconColor: "#00A4FF",
  },
  {
    name: "Tencent TokenHub (Intl)",
    family: "tencent",
    planKey: "payg",
    regionKey: "intl",
    providerKey: "cc-switch-tencent-tokenhub-intl",
    websiteUrl: "https://www.tencentcloud.com/products/tokenhub",
    apiKeyUrl: "https://console.tencentcloud.com/tokenhub/apikey",
    settingsConfig: {
      name: "Tencent TokenHub (Intl)",
      baseUrl: "https://tokenhub-intl.tencentcloudmaas.com/v1",
      api: "openai-completions",
      apiKey: "",
      models: [
        piModel("tencent/hy4-preview", { id: "hy4-preview" }),
        piModel("tencent/hy3", { id: "hy3" }),
        {
          ...piModel("deepseek/deepseek-v4-flash", {
            id: "deepseek-v4-flash-202605",
            name: "DeepSeek V4 Flash Official",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-pro", {
            id: "deepseek-v4-pro-202606",
            name: "DeepSeek V4 Pro Official",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-flash-vision-exp", {
            id: "deepseek/deepseek-v4-flash-vision-exp",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-flash", {
            id: "deepseek-v4-flash-0731",
            name: "DeepSeek V4 Flash 0731 GA",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-pro", {
            id: "deepseek-v4-pro-0813",
            name: "DeepSeek V4 Pro 0813 GA",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-flash", {
            id: "deepseek-v4-flash",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v4-pro", {
            id: "deepseek-v4-pro",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        {
          ...piModel("deepseek/deepseek-v3.2", {
            id: "deepseek-v3.2",
            thinkingProfile: "deepseekV4",
          }),
          compat: { ...TENCENT_DEEPSEEK_THINKING_COMPAT },
        },
        piModel("zai/glm-5.3", { id: "glm-5.3" }),
        piModel("zai/glm-5.3-flash", { id: "glm-5.3-flash" }),
        piModel("zai/glm-5.2", { id: "glm-5.2" }),
        piModel("zai/glm-5", { id: "glm-5" }),
        piModel("zai/glm-5-turbo", { id: "glm-5-turbo" }),
        piModel("zai/glm-5v-turbo", { id: "glm-5v-turbo" }),
        piModel("zai/glm-5.1", { id: "glm-5.1" }),
        piModel("moonshotai/kimi-k3", { id: "kimi-k3" }),
        piModel("moonshotai/kimi-k2.7-code-highspeed", {
          id: "kimi-k2.7-code-highspeed",
          thinkingProfile: "offUnsupported",
        }),
        piModel("moonshotai/kimi-k2.7-code", {
          id: "kimi-k2.7-code",
          thinkingProfile: "offUnsupported",
        }),
        piModel("moonshotai/kimi-k2.6", { id: "kimi-k2.6" }),
        piModel("moonshotai/kimi-k2.5", { id: "kimi-k2.5" }),
        piModel("minimax/minimax-m3", { id: "minimax-m3" }),
        piModel("minimax/minimax-m2.7", { id: "minimax-m2.7" }),
        piModel("xiaomi/mimo-v2.5-pro", { id: "mimo-v2.5-pro" }),
      ],
    },
    category: "cn_official",
    icon: "tencent",
    iconColor: "#00A4FF",
  },
  {
    name: "Tu-zi",
    nameKey: "providerForm.presets.tuzi",
    providerKey: "cc-switch-tuzi",
    websiteUrl: "https://api.tu-zi.com",
    apiKeyUrl: "https://api.tu-zi.com/token",
    settingsConfig: {
      name: "Tu-zi",
      baseUrl: "https://api.tu-zi.com",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("anthropic/claude-opus-5.5", {
          id: "claude-opus-5-5",
        }),
        piModel("anthropic/claude-sonnet-5.5", {
          id: "claude-sonnet-5-5",
        }),
        piModel("anthropic/claude-haiku-5.5", {
          id: "claude-haiku-5-5",
        }),
        piModel("anthropic/claude-fable-5.1", { id: "claude-fable-5-1" }),
      ],
    },
    category: "aggregator",
    icon: "tuzi",
  },
  {
    name: "模力方舟",
    providerKey: "cc-switch-moark",
    websiteUrl: "https://moark.com",
    apiKeyUrl: "https://moark.com/dashboard/tokens",
    settingsConfig: {
      name: "模力方舟",
      baseUrl: "https://api.moark.com/v1",
      api: "openai-completions",
      apiKey: "",
      // 聚合网关，上游思考档位语义未逐一核对，交给 Pi 原生默认行为（{}）
      models: [
        piModel("deepseek/deepseek-flash", {
          id: "deepseek-v4.1-flash",
        }),
        piModel("deepseek/deepseek-v4-pro", { id: "DeepSeek-V4-Pro-0813" }),
        piModel("zai/glm-5.3", { id: "GLM-5.3" }),
        piModel("zai/glm-5.3-flash", { id: "GLM-5.3-Flash" }),
        piModel("moonshotai/kimi-k3.1-pro", { id: "kimi-k3.1-pro" }),
        piModel("qwen/qwen3.8-max", { id: "qwen3.8-max" }),
        piModel("qwen/qwen3.8-flash", { id: "qwen3.8-flash" }),
        piModel("minimax/minimax-m3", { id: "MiniMax-M3" }),
        piModel("stepfun/step-3.7-flash", { id: "Step-3.7-Flash" }),
      ],
    },
    category: "aggregator",
    icon: "moark",
  },
  {
    name: "SoruxGPT",
    providerKey: "cc-switch-sorux-gpt",
    websiteUrl: "https://ai.soruxgpt.com",
    apiKeyUrl: "https://ai.soruxgpt.com/console/token",
    settingsConfig: {
      name: "SoruxGPT",
      baseUrl: "https://ai.soruxgpt.com",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("anthropic/claude-opus-5.5", { id: "claude-opus-5-5" }),
        piModel("anthropic/claude-sonnet-5.5", { id: "claude-sonnet-5-5" }),
        piModel("anthropic/claude-haiku-5.5", {
          id: "claude-haiku-5-5",
        }),
        piModel("anthropic/claude-fable-5.1", { id: "claude-fable-5-1" }),
      ],
    },
    category: "aggregator",
    icon: "soruxgpt",
  },
  {
    name: "IKunCode",
    providerKey: "cc-switch-ikun-code",
    websiteUrl: "https://api.ikuncode.ai",
    apiKeyUrl: "https://api.ikuncode.ai/console/token",
    settingsConfig: {
      name: "IKunCode",
      baseUrl: "https://api.ikuncode.ai",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("anthropic/claude-opus-5.5", { id: "claude-opus-5-5" }),
        piModel("anthropic/claude-sonnet-5.5", { id: "claude-sonnet-5-5" }),
        piModel("anthropic/claude-haiku-5.5", {
          id: "claude-haiku-5-5",
        }),
        piModel("anthropic/claude-fable-5.1", { id: "claude-fable-5-1" }),
      ],
    },
    category: "aggregator",
    icon: "ikuncode",
  },
  {
    name: "RunToken",
    providerKey: "cc-switch-run-token",
    websiteUrl: "https://www.runtoken.ai",
    apiKeyUrl: "https://www.runtoken.ai/console/token",
    settingsConfig: {
      name: "RunToken",
      baseUrl: "https://www.runtoken.ai",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("anthropic/claude-opus-5.5", { id: "claude-opus-5-5" }),
        piModel("anthropic/claude-sonnet-5.5", { id: "claude-sonnet-5-5" }),
        piModel("anthropic/claude-haiku-5.5", {
          id: "claude-haiku-5-5",
        }),
        piModel("anthropic/claude-fable-5.1", { id: "claude-fable-5-1" }),
      ],
    },
    category: "aggregator",
    icon: "runtoken",
  },
  {
    name: "BotCF",
    providerKey: "cc-switch-bot-cf",
    websiteUrl: "https://botcf.com",
    apiKeyUrl: "https://botcf.com/console/token",
    settingsConfig: {
      name: "BotCF",
      baseUrl: "https://botcf.com",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("anthropic/claude-opus-5.5", { id: "claude-opus-5-5" }),
        piModel("anthropic/claude-sonnet-5.5", { id: "claude-sonnet-5-5" }),
        piModel("anthropic/claude-haiku-5.5", {
          id: "claude-haiku-5-5",
        }),
        piModel("anthropic/claude-fable-5.1", { id: "claude-fable-5-1" }),
      ],
    },
    category: "aggregator",
    icon: "botcf",
  },
  {
    name: "YYLX",
    nameKey: "providerForm.presets.yylx",
    providerKey: "cc-switch-yylx",
    websiteUrl: "https://yylx.io",
    apiKeyUrl: "https://app.yylx.io/keys",
    settingsConfig: {
      name: "YYLX",
      baseUrl: "https://app.yylx.io",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("anthropic/claude-opus-5.5", { id: "claude-opus-5-5" }),
        piModel("anthropic/claude-sonnet-5.5", { id: "claude-sonnet-5-5" }),
        piModel("anthropic/claude-haiku-5.5", {
          id: "claude-haiku-5-5",
        }),
        piModel("anthropic/claude-fable-5.1", { id: "claude-fable-5-1" }),
      ],
    },
    category: "aggregator",
    icon: "yylx",
  },
  {
    name: "TokenFlux",
    providerKey: "cc-switch-token-flux",
    websiteUrl: "https://tokenflux.dev",
    apiKeyUrl: "https://tokenflux.dev/keys",
    settingsConfig: {
      name: "TokenFlux",
      baseUrl: "https://tokenflux.dev",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("anthropic/claude-opus-5.5", { id: "claude-opus-5-5" }),
        piModel("anthropic/claude-sonnet-5.5", { id: "claude-sonnet-5-5" }),
        piModel("anthropic/claude-haiku-5.5", {
          id: "claude-haiku-5-5",
        }),
        piModel("anthropic/claude-fable-5.1", { id: "claude-fable-5-1" }),
      ],
    },
    category: "aggregator",
    icon: "tokenflux",
  },
  {
    name: "NekoCode",
    providerKey: "cc-switch-neko-code",
    websiteUrl: "https://nekoapi.ai",
    apiKeyUrl: "https://nekoapi.ai/token",
    settingsConfig: {
      name: "NekoCode",
      baseUrl: "https://nekoapi.ai",
      api: "anthropic-messages",
      apiKey: "",
      headers: {
        "User-Agent": "claude-cli/2.1.161 (external, cli)",
      },
      models: [
        piModel("anthropic/claude-opus-5.5", { id: "claude-opus-5-5" }),
        piModel("anthropic/claude-sonnet-5.5", { id: "claude-sonnet-5-5" }),
        piModel("anthropic/claude-haiku-5.5", {
          id: "claude-haiku-5-5",
        }),
      ],
    },
    category: "aggregator",
    icon: "nekocode",
  },
  {
    name: "AIComing",
    providerKey: "cc-switch-aicoming",
    websiteUrl: "https://aicoming.top",
    apiKeyUrl: "https://aicoming.top/console#keys",
    settingsConfig: {
      name: "AIComing",
      baseUrl: "https://api.aicoming.top",
      api: "anthropic-messages",
      apiKey: "",
      models: [
        piModel("anthropic/claude-opus-5.5", { id: "claude-opus-5-5" }),
        piModel("anthropic/claude-sonnet-5.5", { id: "claude-sonnet-5-5" }),
        piModel("anthropic/claude-haiku-5.5", {
          id: "claude-haiku-5-5",
        }),
        piModel("anthropic/claude-fable-5.1", { id: "claude-fable-5-1" }),
      ],
    },
    category: "aggregator",
    icon: "aicoming",
  },
];

function materializeVerifiedThinkingProfiles(
  preset: PiProviderPreset,
): PiProviderPreset {
  return {
    ...preset,
    settingsConfig: {
      ...preset.settingsConfig,
      models: preset.settingsConfig.models.map((model) => {
        const reference = getPiModelCatalogReference(model);
        if (!reference) return model;
        const resolved = reference.presetThinkingProfileId
          ? getPiThinkingProfile(reference.presetThinkingProfileId)
          : resolvePiThinkingProfile({
              catalogKey: reference.catalogKey,
              api: preset.settingsConfig.api,
            });
        return {
          ...model,
          ...(model.reasoning ? { thinkingLevelMap: resolved?.map ?? {} } : {}),
          ...(resolved?.modelCompat
            ? {
                compat: {
                  ...model.compat,
                  ...resolved.modelCompat,
                },
              }
            : {}),
        };
      }),
    },
  };
}

export const piProviderPresets = piProviderPresetDefinitions.map(
  materializeVerifiedThinkingProfiles,
);
