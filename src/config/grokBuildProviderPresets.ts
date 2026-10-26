/**
 * Grok Build (Grok CLI) 预设供应商配置模板
 *
 * 独立维护，与 codexProviderPresets.ts 无数据联动（Jason 2026-07-21 定）。
 * 初始条目取自当时的 Codex 预设快照，此后两边各自演进：
 * 合作伙伴链接 / 图标 / endpoint 变更需要在本文件单独修改。
 *
 * 收录规则：
 * - 不含官方 / 托管 OAuth 预设：Grok CLI 自带 xAI 订阅登录，官方态走
 *   独立的 "Grok Official" 条目（对应 providers_seed.rs 的 seed，
 *   空 config = 不写自定义模型表）。
 * - 不含国产模型官方直连（cn_official）与纯开源模型托管站
 *   （SiliconFlow / ModelScope / Novita / Nvidia / AtlasCloud）：
 *   这些上游没有 Grok 模型，无法在 Grok CLI 中使用。
 * - OpenCode Go 上游自 2026-08 起已提供 grok-4.5，但暂仍不收录：
 *   订阅制网关是否纳入 Grok 预设属产品决策，收录前需单独评估。
 * - 只收聚合站与第三方中转站，默认模型统一为 grok-4.5；
 *   OpenRouter 系命名空间的路由站用 "x-ai/grok-4.7"。
 *
 * config 字段沿用 Codex 风格 TOML 作为载体：Grok 表单只从中提取
 * base_url / model / wire_api 三个字段（extractCodex* 工具），再重建
 * Grok CLI 自己的 config.toml。
 */
import type { ProviderCategory } from "../types";
import type { CodexApiFormat } from "../types";
import { GROK_BUILD_DEFAULT_MODEL } from "../utils/grokBuildConfig";
import type { PresetFamilyFields } from "./presetFamilies";

export interface GrokBuildProviderPreset extends PresetFamilyFields {
  name: string;
  nameKey?: string; // i18n key for localized display name
  websiteUrl: string;
  apiKeyUrl?: string;
  auth: Record<string, any>;
  config: string; // Codex 风格 TOML 载体（只消费 base_url / model / wire_api）
  isOfficial?: boolean;
  isPartner?: boolean;
  partnerPromotionKey?: string;
  category?: ProviderCategory;
  endpointCandidates?: string[];
  icon?: string;
  iconColor?: string;
  apiFormat?: CodexApiFormat;
}

// 官方条目与后端 seed（providers_seed.rs 的 "Grok Official"）对应：
// 空 config = 不写自定义模型表，Grok CLI 回落到自带的 xAI OAuth 登录。
// 预设 id 复用固定 provider id，AddProviderDialog 据此走 ensure seed 流程。
export const grokBuildOfficialPreset: GrokBuildProviderPreset = {
  name: "Grok Official",
  websiteUrl: "https://x.ai/grok",
  isOfficial: true,
  category: "official",
  auth: {},
  config: "",
  icon: "grok",
  iconColor: "currentColor",
};

/** OpenRouter 系命名空间路由站的 Grok 模型 id */
const OPENROUTER_STYLE_GROK_MODEL = "x-ai/grok-4.7";

const grokAuth = (): Record<string, any> => ({ OPENAI_API_KEY: "" });

function grokPresetConfig(
  providerName: string,
  baseUrl: string,
  model = GROK_BUILD_DEFAULT_MODEL,
): string {
  const tomlString = (value: string) => JSON.stringify(value);

  return `model_provider = "custom"
model = ${tomlString(model)}

[model_providers.custom]
name = ${tomlString(providerName)}
base_url = ${tomlString(baseUrl)}
wire_api = "responses"
requires_openai_auth = true`;
}

export const grokBuildProviderPresets: GrokBuildProviderPreset[] = [
  // ===== 非赞助商预设：应用内展示按显示名排序，此处文件顺序不影响展示 =====
  {
    name: "Tu-zi",
    nameKey: "providerForm.presets.tuzi",
    websiteUrl: "https://api.tu-zi.com",
    apiKeyUrl: "https://api.tu-zi.com/token",
    auth: grokAuth(),
    config: grokPresetConfig("Tu-zi", "https://api.tu-zi.com/v1"),
    endpointCandidates: [
      "https://api.tu-zi.com/v1",
      "https://api.ourzhishi.top/v1",
      "https://api.sydney-ai.com/v1",
      "https://apicdn.tu-zi.com/v1",
    ],
    apiFormat: "openai_responses",
    category: "aggregator",
    icon: "tuzi",
  },
  {
    name: "xAI (Grok)",
    websiteUrl: "https://x.ai/api",
    apiKeyUrl: "https://console.x.ai",
    auth: grokAuth(),
    config: grokPresetConfig("xAI (Grok)", "https://api.x.ai/v1", "grok-4.7"),
    endpointCandidates: ["https://api.x.ai/v1"],
    apiFormat: "openai_responses",
    category: "third_party",
    icon: "xai",
    iconColor: "#000000",
  },
  {
    name: "Amux",
    websiteUrl: "https://amux.ai",
    apiKeyUrl: "https://amux.ai",
    auth: grokAuth(),
    config: grokPresetConfig("Amux", "https://api.amux.ai/v1"),
    endpointCandidates: ["https://api.amux.ai/v1"],
    category: "aggregator",
    icon: "amux",
  },
  {
    name: "AiHubMix",
    websiteUrl: "https://aihubmix.com",
    auth: grokAuth(),
    config: grokPresetConfig("AiHubMix", "https://aihubmix.com/v1"),
    endpointCandidates: [
      "https://aihubmix.com/v1",
      "https://api.aihubmix.com/v1",
    ],
    category: "aggregator",
    icon: "aihubmix",
    iconColor: "#006FFB",
  },
  {
    name: "CherryIN",
    websiteUrl: "https://open.cherryin.ai",
    apiKeyUrl: "https://open.cherryin.ai/console/token",
    auth: grokAuth(),
    config: grokPresetConfig(
      "CherryIN",
      "https://open.cherryin.net/v1",
      OPENROUTER_STYLE_GROK_MODEL,
    ),
    endpointCandidates: ["https://open.cherryin.net/v1"],
    category: "aggregator",
    icon: "cherryin",
  },
  {
    name: "RelaxyCode",
    websiteUrl: "https://www.relaxycode.com",
    apiKeyUrl: "https://www.relaxycode.com/register",
    auth: grokAuth(),
    config: grokPresetConfig("RelaxyCode", "https://www.relaxycode.com/v1"),
    category: "third_party",
    icon: "relaxcode",
  },
  {
    name: "E-FlowCode",
    websiteUrl: "https://e-flowcode.cc",
    apiKeyUrl: "https://e-flowcode.cc",
    auth: grokAuth(),
    config: grokPresetConfig("E-FlowCode", "https://e-flowcode.cc/v1"),
    endpointCandidates: ["https://e-flowcode.cc/v1"],
    category: "third_party",
    icon: "eflowcode",
    iconColor: "#000000",
  },
  {
    name: "PIPELLM",
    websiteUrl: "https://code.pipellm.ai",
    apiKeyUrl: "https://code.pipellm.ai/login?ref=uvw650za",
    auth: grokAuth(),
    config: grokPresetConfig("PIPELLM", "https://cc-api.pipellm.ai/v1"),
    endpointCandidates: ["https://cc-api.pipellm.ai/v1"],
    category: "aggregator",
    icon: "pipellm",
  },
  {
    name: "OpenRouter",
    websiteUrl: "https://openrouter.ai",
    apiKeyUrl: "https://openrouter.ai/keys",
    auth: grokAuth(),
    config: grokPresetConfig(
      "OpenRouter",
      "https://openrouter.ai/api/v1",
      OPENROUTER_STYLE_GROK_MODEL,
    ),
    category: "aggregator",
    icon: "openrouter",
    iconColor: "#6566F1",
  },
  {
    name: "TheRouter",
    websiteUrl: "https://therouter.ai",
    apiKeyUrl: "https://dashboard.therouter.ai",
    auth: grokAuth(),
    config: grokPresetConfig(
      "TheRouter",
      "https://api.therouter.ai/v1",
      // TheRouter 的 xAI 前缀是 xai/（不是 x-ai/）
      "xai/grok-4.7",
    ),
    endpointCandidates: ["https://api.therouter.ai/v1"],
    category: "aggregator",
    icon: "therouter",
  },
  {
    name: "SoruxGPT",
    websiteUrl: "https://ai.soruxgpt.com",
    apiKeyUrl: "https://ai.soruxgpt.com/console/token",
    auth: grokAuth(),
    config: grokPresetConfig("SoruxGPT", "https://ai.soruxgpt.com/v1"),
    endpointCandidates: [
      "https://ai.soruxgpt.com/v1",
      "https://api-cf.soruxgpt.com/v1",
      "https://api-host.soruxgpt.com/v1",
      "https://api-node6.soruxgpt.com/v1",
      "https://api-node3.soruxgpt.com/v1",
    ],
    category: "aggregator",
    icon: "soruxgpt",
  },
  {
    name: "IKunCode",
    websiteUrl: "https://api.ikuncode.ai",
    apiKeyUrl: "https://api.ikuncode.ai/console/token",
    auth: grokAuth(),
    config: grokPresetConfig("IKunCode", "https://api.ikuncode.ai/v1"),
    endpointCandidates: [
      "https://api.ikuncode.ai/v1",
      "https://api.ikuncode.cc/v1",
    ],
    category: "aggregator",
    icon: "ikuncode",
  },
  {
    name: "RunToken",
    websiteUrl: "https://www.runtoken.ai",
    apiKeyUrl: "https://www.runtoken.ai/console/token",
    auth: grokAuth(),
    config: grokPresetConfig("RunToken", "https://www.runtoken.ai/v1"),
    endpointCandidates: [
      "https://www.runtoken.ai/v1",
      "https://fast.runtoken.ai/v1",
    ],
    category: "aggregator",
    icon: "runtoken",
  },
  {
    name: "BotCF",
    websiteUrl: "https://botcf.com",
    apiKeyUrl: "https://botcf.com/console/token",
    auth: grokAuth(),
    config: grokPresetConfig("BotCF", "https://botcf.com/v1"),
    category: "aggregator",
    icon: "botcf",
  },
  {
    name: "YYLX",
    nameKey: "providerForm.presets.yylx",
    websiteUrl: "https://yylx.io",
    apiKeyUrl: "https://app.yylx.io/keys",
    auth: grokAuth(),
    config: grokPresetConfig("YYLX", "https://app.yylx.io/v1"),
    endpointCandidates: [
      "https://app.yylx.io/v1",
      "https://global.yylx.io/v1",
      "https://cn.yylx.io/v1",
    ],
    category: "aggregator",
    icon: "yylx",
  },
  {
    name: "TokenFlux",
    websiteUrl: "https://tokenflux.dev",
    apiKeyUrl: "https://tokenflux.dev/keys",
    auth: grokAuth(),
    config: grokPresetConfig("TokenFlux", "https://tokenflux.dev/v1"),
    category: "aggregator",
    icon: "tokenflux",
  },
  {
    name: "AIComing",
    websiteUrl: "https://aicoming.top",
    apiKeyUrl: "https://aicoming.top/console#keys",
    auth: grokAuth(),
    config: grokPresetConfig("AIComing", "https://api.aicoming.top/v1"),
    category: "aggregator",
    icon: "aicoming",
  },
];
