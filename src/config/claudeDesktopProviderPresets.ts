/**
 * Claude Desktop 预设供应商配置模板
 *
 * 形态与 Claude Code 预设不同：
 * - baseUrl 是顶级字段，而不是 settingsConfig.env.ANTHROPIC_BASE_URL
 * - 模型信息以"Desktop 可见模型 ID → 上游模型"表达，
 *   对应后端 ClaudeDesktopModelRoute 的 routeId / model
 *
 * 翻译来源：src/config/claudeProviderPresets.ts（排除 OAuth 与不兼容预设）
 */
import { ProviderCategory } from "../types";
import type { PresetTheme } from "./claudeProviderPresets";
import type { PresetFamilyFields } from "./presetFamilies";

export type ClaudeDesktopApiFormat =
  | "anthropic"
  | "openai_chat"
  | "openai_responses"
  | "gemini_native";

export interface ClaudeDesktopRoutePreset {
  routeId: string;
  upstreamModel: string;
  labelOverride?: string;
  supports1m: boolean;
}

/**
 * Claude Desktop 3P fail-all 校验接受的角色名。Desktop 1.12603.1+ 起白名单
 * 纳入 fable（app.asar 内 ["sonnet","opus","haiku","fable","mythos"]，实测
 * 2026-06-13）；此前 1.6259.1 仅接受 sonnet/opus/haiku。mythos 官方未公开
 * 发布，暂不暴露给用户。所有预设工厂、表单角色下拉、后端
 * `next_catalog_safe_route_id` 都从此映射派生 routeId，避免散落硬编码。
 */
export const CLAUDE_DESKTOP_ROLE_ROUTE_IDS = {
  sonnet: "claude-sonnet-5",
  opus: "claude-opus-5",
  fable: "claude-fable-5",
  haiku: "claude-haiku-4-5",
} as const;

export type ClaudeDesktopRoleId = keyof typeof CLAUDE_DESKTOP_ROLE_ROUTE_IDS;

export interface ClaudeDesktopProviderPreset extends PresetFamilyFields {
  name: string;
  nameKey?: string;
  websiteUrl: string;
  apiKeyUrl?: string;
  category?: ProviderCategory;
  isPartner?: boolean;
  partnerPromotionKey?: string;

  baseUrl: string;
  apiKeyField?: "ANTHROPIC_AUTH_TOKEN" | "ANTHROPIC_API_KEY";

  mode: "direct" | "proxy";
  apiFormat?: ClaudeDesktopApiFormat;
  modelRoutes?: ClaudeDesktopRoutePreset[];
  providerType?: "github_copilot" | "codex_oauth" | "xai_oauth";
  requiresOAuth?: boolean;
  // 是否在 UI 中隐藏该预设（预设仍存在，仅不在列表中显示）
  hidden?: boolean;

  endpointCandidates?: string[];
  theme?: PresetTheme;
  icon?: string;
  iconColor?: string;
}

/**
 * Claude Haiku 4.x 只有 200K 窗口：声明 1M 的预设里这一档也不能跟着标 1M，
 * 否则 Claude Desktop 会攒到 200K 以上才压缩，上游先报超长。
 */
const isClaudeHaiku4 = (model: string) => /claude-haiku-4[-.]/i.test(model);

const passthroughRoutes = (supports1m = false): ClaudeDesktopRoutePreset[] => [
  {
    routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.sonnet,
    upstreamModel: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.sonnet,
    supports1m,
  },
  {
    routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.opus,
    upstreamModel: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.opus,
    supports1m,
  },
  {
    routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.haiku,
    upstreamModel: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.haiku,
    supports1m:
      supports1m && !isClaudeHaiku4(CLAUDE_DESKTOP_ROLE_ROUTE_IDS.haiku),
  },
];

const mappedRoutes = (
  sonnet: string,
  opus: string,
  haiku: string,
  supports1m = false,
): ClaudeDesktopRoutePreset[] => [
  {
    routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.sonnet,
    upstreamModel: sonnet,
    supports1m,
  },
  {
    routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.opus,
    upstreamModel: opus,
    supports1m,
  },
  {
    routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.haiku,
    upstreamModel: haiku,
    supports1m: supports1m && !isClaudeHaiku4(haiku),
  },
];

/**
 * 非 Claude 上游模型用此工厂：route ID 使用 Claude Desktop 能通过校验的
 * Sonnet/Opus/Haiku 路由，真实品牌名只写入 labelOverride 和 upstreamModel。
 */
const brandedRoutes = (
  sonnet: string,
  opus: string,
  haiku: string,
  supports1m = false,
): ClaudeDesktopRoutePreset[] => {
  const seenUpstream = new Set<string>();
  return [
    { routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.sonnet, upstreamModel: sonnet },
    { routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.opus, upstreamModel: opus },
    { routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.haiku, upstreamModel: haiku },
  ]
    .map(({ routeId, upstreamModel }) => ({
      routeId,
      upstreamModel,
      labelOverride: upstreamModel,
      supports1m,
    }))
    .filter((route) => {
      if (seenUpstream.has(route.upstreamModel)) {
        return false;
      }
      seenUpstream.add(route.upstreamModel);
      return true;
    });
};

export const claudeDesktopProviderPresets: ClaudeDesktopProviderPreset[] = [
  {
    name: "Claude Desktop Official",
    websiteUrl: "https://claude.ai/download",
    category: "official",
    baseUrl: "",
    mode: "direct",
    apiFormat: "anthropic",
    theme: {
      icon: "claude",
      backgroundColor: "#D97757",
      textColor: "#FFFFFF",
    },
    icon: "anthropic",
    iconColor: "#D4915D",
  },
  // ===== 官方直营预设（赞助商预设已于 2026-10-26 按决策整体删除，见 MAINTENANCE.md）=====
  {
    name: "Kimi",
    family: "kimi",
    planKey: "payg",
    regionKey: "cn",
    websiteUrl:
      "https://platform.kimi.com?track_id=track-7cf2b91dcde043eda6ef9a95951a042c&aff=cc-switch",
    category: "cn_official",
    baseUrl: "https://api.moonshot.cn/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "kimi-k2.7-code",
      "kimi-k2.7-code",
      "kimi-k2.7-code",
    ),
    partnerPromotionKey: "kimi",
    icon: "kimi",
    iconColor: "#6366F1",
  },
  {
    name: "Kimi Global",
    family: "kimi",
    planKey: "payg",
    regionKey: "intl",
    websiteUrl:
      "https://platform.kimi.ai?track_id=track-674ed6e2af924a5682a87421f7cf753a&aff=cc-switch",
    category: "cn_official",
    baseUrl: "https://api.moonshot.ai/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "kimi-k2.7-code",
      "kimi-k2.7-code",
      "kimi-k2.7-code",
    ),
    partnerPromotionKey: "kimi",
    icon: "kimi",
    iconColor: "#6366F1",
  },
  {
    name: "Kimi For Coding",
    family: "kimi",
    planKey: "coding",
    regionKey: "cn",
    websiteUrl: "https://www.kimi.com/code/?aff=cc-switch",
    category: "cn_official",
    baseUrl: "https://api.kimi.com/coding/",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: passthroughRoutes(),
    icon: "kimi",
    iconColor: "#6366F1",
  },
  {
    name: "Kimi For Coding Global",
    family: "kimi",
    planKey: "coding",
    regionKey: "intl",
    websiteUrl: "https://www.kimi.ai/code?aff=cc-switch",
    category: "cn_official",
    baseUrl: "https://api.kimi.ai/coding/",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: passthroughRoutes(),
    icon: "kimi",
    iconColor: "#6366F1",
  },
  {
    name: "火山 Agent Plan",
    family: "volcengine",
    planKey: "agentPlan",
    websiteUrl:
      "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    apiKeyUrl:
      "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    category: "cn_official",
    baseUrl: "https://ark.cn-beijing.volces.com/api/plan",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "ark-code-latest",
      "ark-code-latest",
      "ark-code-latest",
    ),
    icon: "huoshan",
    iconColor: "#3370FF",
    isPartner: true,
    partnerPromotionKey: "volcengine_agentplan",
  },
  {
    name: "火山 Coding Plan",
    family: "volcengine",
    planKey: "codingPlan",
    websiteUrl:
      "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    apiKeyUrl:
      "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    category: "cn_official",
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "ark-code-latest",
      "ark-code-latest",
      "ark-code-latest",
    ),
    icon: "huoshan",
    iconColor: "#3370FF",
    isPartner: true,
    partnerPromotionKey: "volcengine_codingplan",
  },
  {
    name: "BytePlus",
    websiteUrl:
      "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    apiKeyUrl:
      "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    category: "cn_official",
    baseUrl: "https://ark.ap-southeast.bytepluses.com/api/coding",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "ark-code-latest",
      "ark-code-latest",
      "ark-code-latest",
    ),
    icon: "byteplus",
    iconColor: "#3370FF",
    isPartner: true,
    partnerPromotionKey: "byteplus",
  },
  {
    name: "Volcengine Doubao",
    family: "volcengine",
    planKey: "payg",
    nameKey: "providerForm.presets.doubaoseed",
    websiteUrl:
      "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    apiKeyUrl:
      "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    category: "cn_official",
    baseUrl: "https://ark.cn-beijing.volces.com/api/compatible",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "doubao-seed-2-1-pro-260915",
      "doubao-seed-2-1-pro-260915",
      "doubao-seed-2-1-pro-260915",
    ),
    isPartner: true,
    partnerPromotionKey: "doubaoseed",
    icon: "doubao",
    iconColor: "#3370FF",
  },
  // ===== 非赞助商预设：应用内展示按显示名排序，此处文件顺序不影响展示 =====
  {
    name: "Tu-zi",
    nameKey: "providerForm.presets.tuzi",
    websiteUrl: "https://api.tu-zi.com",
    apiKeyUrl: "https://api.tu-zi.com/token",
    category: "aggregator",
    baseUrl: "https://api.tu-zi.com",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: passthroughRoutes(true),
    endpointCandidates: [
      "https://api.tu-zi.com",
      "https://api.ourzhishi.top",
      "https://api.sydney-ai.com",
      "https://apicdn.tu-zi.com",
    ],
    icon: "tuzi",
  },
  {
    name: "Amux",
    websiteUrl: "https://amux.ai",
    apiKeyUrl: "https://amux.ai",
    category: "aggregator",
    baseUrl: "https://api.amux.ai",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: passthroughRoutes(true),
    icon: "amux",
  },
  {
    name: "AtlasCloud",
    websiteUrl: "https://www.atlascloud.ai/console/coding-plan",
    apiKeyUrl: "https://www.atlascloud.ai/console/coding-plan",
    category: "aggregator",
    baseUrl: "https://api.atlascloud.ai",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: passthroughRoutes(),
    endpointCandidates: ["https://api.atlascloud.ai"],
    icon: "atlascloud",
  },
  {
    // 模型市场只有 sonnet-5 / opus-5 两款 Claude、没有 Haiku；direct 模式
    // 不能映射，故只声明这两条而非 passthroughRoutes()。
    name: "Soshow",
    websiteUrl: "https://aimarket.so-show.com",
    apiKeyUrl: "https://aimarket.so-show.com/workbench/access-key",
    category: "aggregator",
    baseUrl: "https://maas.so-show.com",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: [
      {
        routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.sonnet,
        upstreamModel: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.sonnet,
        supports1m: true,
      },
      {
        routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.opus,
        upstreamModel: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.opus,
        supports1m: true,
      },
    ],
    icon: "soshow",
  },
  {
    name: "Gemini Native",
    websiteUrl: "https://ai.google.dev/gemini-api",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    category: "third_party",
    baseUrl: "https://generativelanguage.googleapis.com",
    apiKeyField: "ANTHROPIC_API_KEY",
    mode: "proxy",
    apiFormat: "gemini_native",
    modelRoutes: brandedRoutes(
      "gemini-3.8-flash",
      "gemini-3.8-flash",
      "gemini-3.8-flash",
    ),
    endpointCandidates: ["https://generativelanguage.googleapis.com"],
    icon: "gemini",
    iconColor: "#4285F4",
  },
  {
    name: "GitHub Copilot",
    websiteUrl: "https://github.com/features/copilot",
    category: "third_party",
    baseUrl: "https://api.githubcopilot.com",
    mode: "proxy",
    apiFormat: "openai_chat",
    providerType: "github_copilot",
    requiresOAuth: true,
    modelRoutes: brandedRoutes(
      "claude-sonnet-5",
      "claude-sonnet-5",
      "claude-haiku-4.5",
    ),
    icon: "github",
    iconColor: "#000000",
  },
  {
    name: "Codex",
    websiteUrl: "https://openai.com/chatgpt/pricing",
    category: "third_party",
    baseUrl: "https://chatgpt.com/backend-api/codex",
    mode: "proxy",
    apiFormat: "openai_responses",
    providerType: "codex_oauth",
    requiresOAuth: true,
    modelRoutes: brandedRoutes("gpt-5.6-sol", "gpt-5.6-sol", "gpt-5.6-luna"),
    icon: "openai",
    iconColor: "#000000",
  },
  {
    name: "xAI (Grok)",
    websiteUrl: "https://x.ai/grok",
    category: "third_party",
    baseUrl: "https://api.x.ai/v1",
    mode: "proxy",
    apiFormat: "openai_responses",
    providerType: "xai_oauth",
    requiresOAuth: true,
    modelRoutes: brandedRoutes("grok-4.7", "grok-4.7", "grok-4.7"),
    icon: "xai",
    iconColor: "#000000",
  },
  {
    name: "DeepSeek",
    websiteUrl: "https://platform.deepseek.com",
    category: "cn_official",
    baseUrl: "https://api.deepseek.com/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    // supports1m：两个档位钉的都是 1M 窗口模型（本仓 Codex catalog 记
    // deepseek-v4-pro / deepseek-flash 均 1048576；haiku 档的
    // deepseek-v4-flash 被官方端点路由到 V4.1 Flash，窗口同档）。[1m] 只是
    // Claude Desktop 本地标记，匹配前会被剥掉，不会随请求发往上游
    modelRoutes: brandedRoutes(
      "deepseek-v4-pro",
      "deepseek-v4-pro",
      "deepseek-flash",
      true,
    ),
    icon: "deepseek",
    iconColor: "#1E88E5",
  },
  {
    // 腾讯云 Token Plan 个人版：通用 + Hy 两系列共用端点与 Key，
    // Auto 智能路由调用 ID 为 tc-code-latest（1823/130060）
    name: "Tencent Token Plan",
    family: "tencent",
    planKey: "tokenPlan",
    regionKey: "cn",
    websiteUrl: "https://cloud.tencent.com/product/tokenhub",
    apiKeyUrl: "https://console.cloud.tencent.com/tokenhub/tokenplan",
    category: "cn_official",
    baseUrl: "https://api.lkeap.cloud.tencent.com/plan/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "tc-code-latest",
      "tc-code-latest",
      "tc-code-latest",
    ),
    endpointCandidates: ["https://api.lkeap.cloud.tencent.com/plan/anthropic"],
    icon: "tencent",
    iconColor: "#0052D9",
  },
  {
    // 国际站（新加坡）个人版（intl 1300/81315）：Auto 调用 ID 是 auto
    name: "Tencent Token Plan (Intl)",
    family: "tencent",
    planKey: "tokenPlan",
    regionKey: "intl",
    websiteUrl: "https://www.tencentcloud.com/products/tokenhub",
    apiKeyUrl: "https://console.tencentcloud.com/tokenhub/tokenplan",
    category: "cn_official",
    baseUrl: "https://tokenhub-intl.tencentcloudmaas.com/plan/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes("auto", "auto", "auto"),
    endpointCandidates: [
      "https://tokenhub-intl.tencentcloudmaas.com/plan/anthropic",
    ],
    icon: "tencent",
    iconColor: "#0052D9",
  },
  {
    // Token Plan 企业版专业套餐（1823/130659，广州地域）
    name: "Tencent Token Plan Enterprise Pro",
    family: "tencent",
    planKey: "enterprisePro",
    regionKey: "cn",
    websiteUrl: "https://cloud.tencent.com/product/tokenhub",
    apiKeyUrl: "https://console.cloud.tencent.com/tokenhub/tokenplan-e",
    category: "cn_official",
    baseUrl: "https://tokenhub.tencentmaas.com/plan/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes("auto", "auto", "auto"),
    // 广州地域为默认端点；国内站企业套餐另可选新加坡地域（1823/130659、
    // 131173 双地域表：tokenhub-intl.tencentmaas.com，需开通新加坡地域，
    // 不支持跨地域调用，故仅作候选端点）
    endpointCandidates: [
      "https://tokenhub.tencentmaas.com/plan/anthropic",
      "https://tokenhub-intl.tencentmaas.com/plan/anthropic",
    ],
    icon: "tencent",
    iconColor: "#0052D9",
  },
  {
    // 国际站企业版专业套餐（intl 1300/81489，新加坡地域）
    name: "Tencent Token Plan Enterprise Pro (Intl)",
    family: "tencent",
    planKey: "enterprisePro",
    regionKey: "intl",
    websiteUrl: "https://www.tencentcloud.com/products/tokenhub",
    apiKeyUrl: "https://console.tencentcloud.com/tokenhub/tokenplan-e",
    category: "cn_official",
    baseUrl: "https://tokenhub-intl.tencentcloudmaas.com/plan/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes("auto", "auto", "auto"),
    // 新加坡地域为默认端点；国际站企业套餐另可选广州地域（1300/81489、
    // 81490 双地域表：tokenhub.tencentcloudmaas.com，需开通广州地域，
    // 不支持跨地域调用，故仅作候选端点）
    endpointCandidates: [
      "https://tokenhub-intl.tencentcloudmaas.com/plan/anthropic",
      "https://tokenhub.tencentcloudmaas.com/plan/anthropic",
    ],
    icon: "tencent",
    iconColor: "#0052D9",
  },
  {
    // Token Plan 企业版轻享套餐（1823/131173）：仅 Auto 模型
    name: "Tencent Token Plan Enterprise Lite",
    family: "tencent",
    planKey: "enterpriseLite",
    regionKey: "cn",
    websiteUrl: "https://cloud.tencent.com/product/tokenhub",
    apiKeyUrl: "https://console.cloud.tencent.com/tokenhub/tokenplan-e",
    category: "cn_official",
    baseUrl: "https://tokenhub.tencentmaas.com/plan/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes("auto", "auto", "auto"),
    // 广州地域为默认端点；国内站企业套餐另可选新加坡地域（1823/130659、
    // 131173 双地域表：tokenhub-intl.tencentmaas.com，需开通新加坡地域，
    // 不支持跨地域调用，故仅作候选端点）
    endpointCandidates: [
      "https://tokenhub.tencentmaas.com/plan/anthropic",
      "https://tokenhub-intl.tencentmaas.com/plan/anthropic",
    ],
    icon: "tencent",
    iconColor: "#0052D9",
  },
  {
    // 国际站企业版轻享套餐（intl 1300/81490，新加坡地域）
    name: "Tencent Token Plan Enterprise Lite (Intl)",
    family: "tencent",
    planKey: "enterpriseLite",
    regionKey: "intl",
    websiteUrl: "https://www.tencentcloud.com/products/tokenhub",
    apiKeyUrl: "https://console.tencentcloud.com/tokenhub/tokenplan-e",
    category: "cn_official",
    baseUrl: "https://tokenhub-intl.tencentcloudmaas.com/plan/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes("auto", "auto", "auto"),
    // 新加坡地域为默认端点；国际站企业套餐另可选广州地域（1300/81489、
    // 81490 双地域表：tokenhub.tencentcloudmaas.com，需开通广州地域，
    // 不支持跨地域调用，故仅作候选端点）
    endpointCandidates: [
      "https://tokenhub-intl.tencentcloudmaas.com/plan/anthropic",
      "https://tokenhub.tencentcloudmaas.com/plan/anthropic",
    ],
    icon: "tencent",
    iconColor: "#0052D9",
  },
  {
    name: "Zhipu GLM",
    family: "zhipu",
    regionKey: "cn",
    websiteUrl: "https://open.bigmodel.cn",
    apiKeyUrl: "https://www.bigmodel.cn/claude-code",
    category: "cn_official",
    baseUrl: "https://open.bigmodel.cn/api/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes("glm-5.3", "glm-5.3", "glm-5.3", true),
    icon: "zhipu",
    iconColor: "#0F62FE",
  },
  {
    name: "Zhipu GLM en",
    family: "zhipu",
    regionKey: "intl",
    websiteUrl: "https://z.ai",
    apiKeyUrl: "https://z.ai/subscribe",
    category: "cn_official",
    baseUrl: "https://api.z.ai/api/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes("glm-5.3", "glm-5.3", "glm-5.3", true),
    icon: "zhipu",
    iconColor: "#0F62FE",
  },
  {
    name: "Baidu Qianfan Coding Plan",
    family: "baidu-qianfan",
    planKey: "codingPlan",
    websiteUrl: "https://cloud.baidu.com/product/qianfan_modelbuilder",
    apiKeyUrl:
      "https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application",
    category: "cn_official",
    baseUrl: "https://qianfan.baidubce.com/anthropic/coding",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "qianfan-code-latest",
      "qianfan-code-latest",
      "qianfan-code-latest",
    ),
    endpointCandidates: ["https://qianfan.baidubce.com/anthropic/coding"],
    icon: "baidu",
    iconColor: "#2932E1",
  },
  {
    // Token Plan 个人版：2026-07-13 起替代 Coding Plan 发售（存量 Coding
    // Plan 可用至到期，旧预设保留）。模型=官方 Claude Code 接入页
    // （2026-07-30 版）全角色 deepseek-v4-pro
    name: "Baidu Qianfan Token Plan",
    family: "baidu-qianfan",
    planKey: "tokenPlan",
    websiteUrl: "https://cloud.baidu.com/product/codingplan.html",
    apiKeyUrl: "https://console.bce.baidu.com/qianfan/resource/token-plan",
    category: "cn_official",
    baseUrl: "https://qianfan.baidubce.com/anthropic/tokenplan/personal",
    mode: "proxy",
    apiFormat: "anthropic",
    // supports1m：DeepSeek V4 Pro 官方窗口 1M（千帆平台模型列表口径，
    // 本仓 Codex catalog 同记 1048576）。[1m] 只是 Claude Desktop 本地
    // 标记，匹配前会被剥掉，不会随请求发往上游
    modelRoutes: brandedRoutes(
      "deepseek-v4-pro",
      "deepseek-v4-pro",
      "deepseek-v4-pro",
      true,
    ),
    endpointCandidates: [
      "https://qianfan.baidubce.com/anthropic/tokenplan/personal",
    ],
    icon: "baidu",
    iconColor: "#2932E1",
  },
  {
    name: "千问AI平台",
    family: "qianwen",
    planKey: "payg",
    websiteUrl: "https://platform.qianwenai.com/?utm_content=g_20000002971",
    apiKeyUrl:
      "https://platform.qianwenai.com/home/api-keys?utm_content=g_20000002972",
    category: "cn_official",
    baseUrl: "https://dashscope.aliyuncs.com/apps/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "qwen3.7-plus",
      "qwen3.8-max",
      "qwen3.8-flash",
      true,
    ),
    icon: "qianwenai",
    iconColor: "#624AFF",
  },
  {
    name: "千问AI平台 Coding Plan",
    family: "qianwen",
    planKey: "codingPlan",
    websiteUrl: "https://bailian.console.aliyun.com",
    category: "cn_official",
    baseUrl: "https://coding.dashscope.aliyuncs.com/apps/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: passthroughRoutes(),
    icon: "qianwenai",
    iconColor: "#624AFF",
  },
  {
    name: "千问AI平台 Token Plan",
    family: "qianwen",
    planKey: "tokenPlan",
    websiteUrl:
      "https://platform.qianwenai.com/pricing/token-plan?utm_content=g_20000002977",
    apiKeyUrl:
      "https://platform.qianwenai.com/home/api-keys?utm_content=g_20000002978",
    category: "cn_official",
    baseUrl: "https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "qwen3.7-plus",
      "qwen3.8-max",
      "qwen3.8-flash",
      true,
    ),
    icon: "qianwenai",
    iconColor: "#624AFF",
  },
  // ===== QwenCloud（DashScope 国际站）=====
  // 与上面国内条目是两套独立站点：域名、控制台、密钥互不通用。
  // 官方文档要求把 ANTHROPIC_MODEL 显式设成 qwen 模型名，端点不认
  // claude-* 别名，所以走 brandedRoutes 而不是 passthroughRoutes。
  {
    name: "QwenCloud",
    family: "qwencloud",
    planKey: "payg",
    websiteUrl: "https://home.qwencloud.com/?utm_content=g_20000002974",
    apiKeyUrl: "https://home.qwencloud.com/api-keys?utm_content=g_20000002975",
    category: "cn_official",
    baseUrl: "https://dashscope-intl.aliyuncs.com/apps/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    // 不挂 [1m]：qwen3.8 系官方窗口是 983616，不足 1M，
    // Desktop 对模型能力校验是精确的，误标会被上游拒绝
    modelRoutes: brandedRoutes(
      "qwen3.7-plus",
      "qwen3.8-max",
      "qwen3.8-flash",
      true,
    ),
    icon: "qwencloud",
    iconColor: "#6336E7",
  },
  {
    name: "QwenCloud For Coding",
    family: "qwencloud",
    planKey: "coding",
    websiteUrl: "https://www.qwencloud.com",
    apiKeyUrl: "https://home.qwencloud.com/api-keys",
    category: "cn_official",
    baseUrl: "https://coding-intl.dashscope.aliyuncs.com/apps/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    // 挂 [1m]：本条钉的是 qwen3.7-plus，官方窗口 1000000
    modelRoutes: brandedRoutes(
      "qwen3.7-plus",
      "qwen3.7-plus",
      "qwen3.7-plus",
      true,
    ),
    icon: "qwencloud",
    iconColor: "#6336E7",
  },
  {
    name: "QwenCloud Token Plan",
    family: "qwencloud",
    planKey: "tokenPlan",
    websiteUrl:
      "https://www.qwencloud.com/pricing/token-plan?utm_content=g_20000002980",
    apiKeyUrl: "https://home.qwencloud.com/api-keys?utm_content=g_20000002981",
    category: "cn_official",
    baseUrl:
      "https://token-plan.ap-southeast-1.maas.aliyuncs.com/apps/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    // 不挂 [1m]：qwen3.8 系官方窗口是 983616，不足 1M，
    // Desktop 对模型能力校验是精确的，误标会被上游拒绝
    modelRoutes: brandedRoutes(
      "qwen3.7-plus",
      "qwen3.8-max",
      "qwen3.8-flash",
      true,
    ),
    icon: "qwencloud",
    iconColor: "#6336E7",
  },
  {
    name: "StepFun",
    family: "stepfun",
    regionKey: "cn",
    websiteUrl: "https://platform.stepfun.com/step-plan",
    apiKeyUrl: "https://platform.stepfun.com/interface-key",
    category: "cn_official",
    baseUrl: "https://api.stepfun.com/step_plan",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "step-5-preview",
      "step-5-preview",
      "step-5-preview",
    ),
    endpointCandidates: ["https://api.stepfun.com/step_plan"],
    icon: "stepfun",
    iconColor: "#16D6D2",
  },
  {
    name: "StepFun en",
    family: "stepfun",
    regionKey: "intl",
    websiteUrl: "https://platform.stepfun.ai/step-plan",
    apiKeyUrl: "https://platform.stepfun.ai/interface-key",
    category: "cn_official",
    baseUrl: "https://api.stepfun.ai/step_plan",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "step-3.5-flash-2603",
      "step-3.5-flash-2603",
      "step-3.5-flash-2603",
    ),
    endpointCandidates: ["https://api.stepfun.ai/step_plan"],
    icon: "stepfun",
    iconColor: "#16D6D2",
  },
  {
    name: "ModelScope",
    websiteUrl: "https://modelscope.cn",
    category: "aggregator",
    baseUrl: "https://api-inference.modelscope.cn",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "ZhipuAI/GLM-5.2",
      "ZhipuAI/GLM-5.2",
      "ZhipuAI/GLM-5.2",
      true,
    ),
    icon: "modelscope",
    iconColor: "#624AFF",
  },
  {
    name: "Longcat",
    websiteUrl: "https://longcat.chat/platform",
    apiKeyUrl: "https://longcat.chat/platform/api_keys",
    category: "cn_official",
    baseUrl: "https://api.longcat.chat/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "LongCat-2.0",
      "LongCat-2.0",
      "LongCat-2.0",
      true,
    ),
    icon: "longcat",
    iconColor: "#29E154",
  },
  {
    name: "MiniMax",
    family: "minimax",
    regionKey: "cn",
    websiteUrl: "https://platform.minimax.cn",
    apiKeyUrl: "https://platform.minimax.cn/subscribe/token-plan",
    category: "cn_official",
    baseUrl: "https://api.minimax.cn/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: [
      ...brandedRoutes(
        "MiniMax-M3.1-Flash",
        "MiniMax-M3.1-Flash",
        "MiniMax-M3.1-Flash",
        true,
      ),
      // extra route (fable slot) so M3 stays selectable; defaults stay on M3.1
      {
        routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.fable,
        upstreamModel: "MiniMax-M3",
        labelOverride: "MiniMax-M3",
        supports1m: true,
      },
    ],
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
    websiteUrl: "https://platform.minimax.io",
    apiKeyUrl: "https://platform.minimax.io/subscribe/coding-plan",
    category: "cn_official",
    baseUrl: "https://api.minimax.io/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: [
      ...brandedRoutes(
        "MiniMax-M3.1-Flash",
        "MiniMax-M3.1-Flash",
        "MiniMax-M3.1-Flash",
        true,
      ),
      // extra route (fable slot) so M3 stays selectable; defaults stay on M3.1
      {
        routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.fable,
        upstreamModel: "MiniMax-M3",
        labelOverride: "MiniMax-M3",
        supports1m: true,
      },
    ],
    theme: {
      backgroundColor: "#f64551",
      textColor: "#FFFFFF",
    },
    icon: "minimax",
    iconColor: "#FF6B6B",
  },
  {
    name: "BaiLing",
    websiteUrl: "https://developer.ant-ling.com/zh-CN/docs/",
    apiKeyUrl: "https://chat.ant-ling.com/open",
    category: "cn_official",
    baseUrl: "https://api.ant-ling.com/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes("Ling-2.6-1T", "Ling-2.6-1T", "Ling-2.6-1T"),
    icon: "bailing",
  },
  {
    name: "AiHubMix",
    websiteUrl: "https://aihubmix.com",
    apiKeyUrl: "https://aihubmix.com",
    category: "aggregator",
    baseUrl: "https://aihubmix.com",
    apiKeyField: "ANTHROPIC_API_KEY",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: passthroughRoutes(true),
    endpointCandidates: ["https://aihubmix.com", "https://api.aihubmix.com"],
    icon: "aihubmix",
    iconColor: "#006FFB",
  },
  {
    name: "CherryIN",
    websiteUrl: "https://open.cherryin.ai",
    apiKeyUrl: "https://open.cherryin.ai/console/token",
    category: "aggregator",
    baseUrl: "https://open.cherryin.net",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: mappedRoutes(
      "anthropic/claude-sonnet-5.5",
      "anthropic/claude-opus-5.5",
      "anthropic/claude-haiku-5.5",
      true,
    ),
    endpointCandidates: ["https://open.cherryin.net"],
    icon: "cherryin",
  },
  {
    name: "RelaxyCode",
    websiteUrl: "https://www.relaxycode.com",
    apiKeyUrl: "https://www.relaxycode.com/register",
    category: "third_party",
    baseUrl: "https://www.relaxycode.com",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: passthroughRoutes(true),
    icon: "relaxcode",
  },
  {
    name: "E-FlowCode",
    websiteUrl: "https://e-flowcode.cc",
    apiKeyUrl: "https://e-flowcode.cc",
    category: "third_party",
    baseUrl: "https://e-flowcode.cc",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: passthroughRoutes(true),
    endpointCandidates: ["https://e-flowcode.cc"],
    icon: "eflowcode",
    iconColor: "#000000",
  },
  {
    name: "OpenRouter",
    websiteUrl: "https://openrouter.ai",
    apiKeyUrl: "https://openrouter.ai/keys",
    category: "aggregator",
    baseUrl: "https://openrouter.ai/api",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: mappedRoutes(
      "anthropic/claude-sonnet-5.5",
      "anthropic/claude-opus-5.5",
      "anthropic/claude-haiku-5.5",
      true,
    ),
    icon: "openrouter",
    iconColor: "#6566F1",
  },
  {
    name: "TheRouter",
    websiteUrl: "https://therouter.ai",
    apiKeyUrl: "https://dashboard.therouter.ai",
    category: "aggregator",
    baseUrl: "https://api.therouter.ai",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: mappedRoutes(
      "anthropic/claude-sonnet-5-5",
      "anthropic/claude-opus-5-5",
      "anthropic/claude-haiku-5-5",
      true,
    ),
    endpointCandidates: ["https://api.therouter.ai"],
    icon: "therouter",
  },
  {
    name: "Baseten",
    websiteUrl: "https://www.baseten.co",
    apiKeyUrl: "https://app.baseten.co/settings/api_keys",
    category: "aggregator",
    icon: "baseten",
    // 同 Claude Code 预设：Messages 端点（beta）只认 Bearer，路由按
    // ANTHROPIC_AUTH_TOKEN 发 Bearer；三个模型窗口均为 1M（docs.baseten.co/
    // development/model-apis/overview，2026-10-14 核对）。Claude Code 若改走
    // openai_chat，这里一起改
    baseUrl: "https://inference.baseten.co",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "zai-org/GLM-5.3",
      "moonshotai/Kimi-K3",
      "zai-org/GLM-5.3-Flash",
      true,
    ),
    endpointCandidates: ["https://inference.baseten.co"],
  },
  {
    name: "Novita AI",
    websiteUrl: "https://novita.ai",
    apiKeyUrl: "https://novita.ai",
    category: "aggregator",
    baseUrl: "https://api.novita.ai/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "zai-org/glm-5.3",
      "zai-org/glm-5.3",
      "zai-org/glm-5.3-flash",
    ),
    endpointCandidates: ["https://api.novita.ai/anthropic"],
    icon: "novita",
    iconColor: "#000000",
  },
  {
    name: "Ollama Cloud",
    websiteUrl: "https://ollama.com",
    apiKeyUrl: "https://ollama.com/settings/keys",
    category: "cloud_provider",
    // 云端 Anthropic 兼容层（docs.ollama.com/api/anthropic-compatibility，
    // 2026-10-14 核对）只认 Bearer，路由按 ANTHROPIC_AUTH_TOKEN 发 Bearer；
    // 三个模型窗口均为 1M（https://ollama.com/api/show）
    baseUrl: "https://ollama.com",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes("glm-5.3", "kimi-k3", "glm-5.3-flash", true),
    endpointCandidates: ["https://ollama.com"],
    icon: "ollama",
  },
  {
    name: "Ollama",
    websiteUrl: "https://ollama.com",
    category: "local",
    // 同 Claude Code 预设：本机 /v1/messages（v0.14.0 起，docs.ollama.com/api/
    // anthropic-compatibility，2026-10-14 核对）。服务端不校验 Key，但表单要求
    // 必填，选预设后手填 ollama 即可。模型名不是 Claude，只能走路由；qwen3.5 是
    // 官方示例，换成自己已下载的模型或用「获取模型」拉取。原生窗口 262144
    // 小于 1M，不开 1M
    baseUrl: "http://localhost:11434",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes("qwen3.5", "qwen3.5", "qwen3.5"),
    endpointCandidates: ["http://localhost:11434", "http://127.0.0.1:11434"],
    icon: "ollama",
  },
  {
    name: "LM Studio",
    websiteUrl: "https://lmstudio.ai",
    category: "local",
    icon: "lmstudio",
    // 同 Claude Code 预设：本机 /v1/messages（0.4.1 起，lmstudio.ai/docs/
    // developer/anthropic-compat，2026-10-14 核对）。默认不鉴权，但表单要求
    // 必填，选预设后手填 lmstudio 即可（开启鉴权后填 API Token）。模型名不是
    // Claude，只能走路由；openai/gpt-oss-20b 是官方示例，换成自己已下载的模型
    // 或用「获取模型」拉取。原生窗口 131072 小于 1M，不开 1M
    baseUrl: "http://localhost:1234",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "openai/gpt-oss-20b",
      "openai/gpt-oss-20b",
      "openai/gpt-oss-20b",
    ),
    endpointCandidates: ["http://localhost:1234", "http://127.0.0.1:1234"],
  },
  {
    name: "llama.cpp",
    websiteUrl: "https://github.com/ggml-org/llama.cpp",
    category: "local",
    icon: "llamacpp",
    // 同 Claude Code 预设：本机 llama-server 的 /v1/messages（b7187 起，
    // github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md，
    // 2026-10-14 核对），默认端口 b11521 起为 9931，旧版 / Homebrew / Docker 为
    // 8080。不带 --api-key 时不校验，但表单要求必填，选预设后手填 no-key 即可
    //（带了 --api-key 就填那个值）。模型名不是 Claude，只能走路由；默认模型
    // 换成自己已下载的或用「获取模型」拉取。Qwen3-Coder 原生窗口 262144 小于
    // 1M，不开 1M
    baseUrl: "http://127.0.0.1:9931",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "ggml-org/Qwen3-Coder-30B-A3B-Instruct-Q8_0-GGUF",
      "ggml-org/Qwen3-Coder-30B-A3B-Instruct-Q8_0-GGUF",
      "ggml-org/Qwen3-Coder-30B-A3B-Instruct-Q8_0-GGUF",
    ),
    endpointCandidates: ["http://127.0.0.1:9931", "http://127.0.0.1:8080"],
  },
  {
    name: "vLLM",
    websiteUrl: "https://vllm.ai",
    category: "local",
    icon: "vllm",
    // 同 Claude Code 预设：本机 vllm serve 的 /v1/messages（v0.11.1 起，
    // docs.vllm.ai/en/stable/serving/integrations/claude_code，2026-10-14 核对），
    // 要求 vLLM ≥ 0.23.0，默认端口 8000。不带 --api-key 时不校验，但表单要求
    // 必填，选预设后手填 dummy 即可（带了 --api-key 就填那个值，只认 Bearer）。
    // 模型名不是 Claude，只能走路由；默认模型换成自己已下载的或用「获取模型」
    // 拉取。Qwen3.6-27B 原生窗口 262144 小于 1M，不开 1M
    baseUrl: "http://localhost:8000",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "Qwen/Qwen3.6-27B",
      "Qwen/Qwen3.6-27B",
      "Qwen/Qwen3.6-27B",
    ),
    endpointCandidates: ["http://localhost:8000", "http://127.0.0.1:8000"],
  },
  {
    name: "Meta Model API",
    websiteUrl: "https://dev.meta.ai",
    apiKeyUrl: "https://dev.meta.ai",
    category: "cn_official",
    // 同 Claude Code 预设：Messages 端点 /v1/messages 只认 Bearer，路由按
    // ANTHROPIC_AUTH_TOKEN 发 Bearer（dev.meta.ai/docs/coding-agents.md，
    // 2026-10-14 核对）；模型名非 Claude，只能走路由。两款窗口均为 1M
    //（dev.meta.ai/docs/models.md）。haiku 与 sonnet 同为 Spark 1.3，按上游
    // 去重后只剩两条路由
    baseUrl: "https://api.meta.ai",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "muse-spark-1.3",
      "muse-wonder-1.0",
      "muse-spark-1.3",
      true,
    ),
    endpointCandidates: ["https://api.meta.ai"],
    icon: "meta",
  },
  {
    name: "DeepInfra",
    websiteUrl: "https://deepinfra.com",
    apiKeyUrl: "https://deepinfra.com/dash/api_keys",
    category: "aggregator",
    icon: "deepinfra",
    // 同 Claude Code 预设：Anthropic 兼容端点（docs.deepinfra.com/integrations/
    // anthropic.md，2026-10-14 核对）；模型名非 Claude，只能走路由。窗口取
    // https://api.deepinfra.com/models/<id> 同日元数据：两款 DeepSeek 1M、
    // Ling-3.0-flash 128K，brandedRoutes 的 supports1m 一刀切，故内联逐条写
    baseUrl: "https://api.deepinfra.com/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: [
      {
        routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.sonnet,
        upstreamModel: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
        labelOverride: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
        supports1m: true,
      },
      {
        routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.opus,
        upstreamModel: "deepseek-ai/DeepSeek-V4-Pro-0813",
        labelOverride: "deepseek-ai/DeepSeek-V4-Pro-0813",
        supports1m: true,
      },
      {
        routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.haiku,
        upstreamModel: "inclusionAI/Ling-3.0-flash",
        labelOverride: "inclusionAI/Ling-3.0-flash",
        supports1m: false,
      },
    ],
    endpointCandidates: ["https://api.deepinfra.com/anthropic"],
  },
  {
    name: "Vercel AI Gateway",
    websiteUrl: "https://vercel.com/ai-gateway",
    apiKeyUrl:
      "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway%2Fapi-keys",
    category: "aggregator",
    // 同 Claude Code 预设：/claude-code 兼容面（vercel.com/docs/ai-gateway/
    // coding-agents/claude-code，2026-10-14 核对）。上游 ID 带 anthropic/ 前缀，
    // 网关是否接受 Desktop 发的无前缀 claude-sonnet-5 未证实，照 OpenRouter /
    // TheRouter 走路由映射；三个模型平台目录窗口均为 1M
    baseUrl: "https://ai-gateway.vercel.sh/claude-code",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: mappedRoutes(
      "anthropic/claude-sonnet-5.5",
      "anthropic/claude-opus-5.5",
      "anthropic/claude-haiku-5.5",
      true,
    ),
    endpointCandidates: ["https://ai-gateway.vercel.sh/claude-code"],
    icon: "vercel",
  },
  {
    name: "Nebius Token Factory",
    websiteUrl: "https://nebius.com/token-factory",
    apiKeyUrl: "https://tokenfactory.nebius.com/project/api-keys",
    category: "aggregator",
    icon: "nebius",
    // 同 Claude Code 预设：官方没有 Anthropic 端点（/v1/messages 实测 404，
    // api.tokenfactory.nebius.com/openapi.json，2026-10-14 核对），走
    // openai_chat 路由。GLM-5.3 与 GLM-5.3-Flash 在官方目录
    // tokenfactory.nebius.com/api/public/models_info 同日窗口均为 1024000
    baseUrl: "https://api.tokenfactory.nebius.com",
    mode: "proxy",
    apiFormat: "openai_chat",
    modelRoutes: brandedRoutes(
      "zai-org/GLM-5.3",
      "zai-org/GLM-5.3",
      "zai-org/GLM-5.3-Flash",
      true,
    ),
    endpointCandidates: ["https://api.tokenfactory.nebius.com"],
  },
  {
    name: "Groq",
    websiteUrl: "https://groq.com",
    apiKeyUrl: "https://console.groq.com/keys",
    category: "aggregator",
    icon: "groq",
    // 同 Claude Code 预设：没有可用的 Anthropic 端点（/anthropic/v1/messages
    // 实测 404，2026-10-14），走 openai_chat 路由。gpt-oss 两款窗口均为
    // 131072（console.groq.com/docs/models），不标 1M
    baseUrl: "https://api.groq.com/openai/v1",
    mode: "proxy",
    apiFormat: "openai_chat",
    modelRoutes: brandedRoutes(
      "openai/gpt-oss-120b",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
    ),
    endpointCandidates: ["https://api.groq.com/openai/v1"],
  },
  {
    name: "SambaNova",
    websiteUrl: "https://sambanova.ai",
    apiKeyUrl: "https://cloud.sambanova.ai/apis",
    category: "cloud_provider",
    icon: "sambanova",
    // 同 Claude Code 预设：Anthropic 兼容端点，base 不带 /v1（docs.sambanova.ai/
    // docs/en/integrations/claude-code，2026-10-14 核对）；模型名非 Claude，只能
    // 走路由。MiniMax-M3 窗口 1048576（公开 /v1/models 同日），标 1M。Messages
    // 不支持 document（PDF）块与 URL 图片（docs.sambanova.ai/docs/en/features/
    // messages），且 MiniMax-M3 在 SambaCloud 上只收文字，Desktop 里传附件会失败
    baseUrl: "https://api.sambanova.ai",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes("MiniMax-M3", "MiniMax-M3", "MiniMax-M3", true),
    endpointCandidates: ["https://api.sambanova.ai"],
  },
  {
    name: "DigitalOcean",
    websiteUrl: "https://www.digitalocean.com/products/ai-platform",
    apiKeyUrl: "https://cloud.digitalocean.com/model-studio/manage-keys",
    category: "cloud_provider",
    icon: "digitalocean",
    // 同 Claude Code 预设：Anthropic 端点 base 不带 /v1，接受 Bearer 与 Claude
    // 原生模型 ID（docs.digitalocean.com/products/inference/how-to/
    // use-with-coding-agents 与 reference/api/reference/serverless-inference，
    // 2026-10-14 核对），直连即可。三个路由在平台上都有对应模型：Sonnet 5 /
    // Opus 5 为 1M 窗口，Haiku 4.5 为 200K（docs.digitalocean.com/products/
    // inference/details/models 同日）。官方排障表说 BETA 标记会导致鉴权失败，
    // Desktop 设不了关 beta 的变量，它自己发的 beta 头是否触发未经真 Key 实测
    //（同 Soshow）。Tier 1 / Tier 2 账号用不了 Anthropic 模型
    baseUrl: "https://inference.do-ai.run",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: [
      {
        routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.sonnet,
        upstreamModel: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.sonnet,
        supports1m: true,
      },
      {
        routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.opus,
        upstreamModel: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.opus,
        supports1m: true,
      },
      {
        routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.haiku,
        upstreamModel: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.haiku,
        supports1m: false,
      },
    ],
    endpointCandidates: ["https://inference.do-ai.run"],
  },
  {
    name: "Hugging Face",
    websiteUrl: "https://huggingface.co/inference/models",
    apiKeyUrl:
      "https://huggingface.co/settings/tokens/new?ownUserPermissions=inference.serverless.write&tokenType=fineGrained",
    category: "aggregator",
    // 同 Claude Code 预设：Anthropic 端点 base 不带 /v1，发 Bearer
    //（huggingface.co/docs/inference-providers/integrations/claude-code，
    // 2026-10-14 核对）；模型名非 Claude，只能走路由。上游钉 :baseten，路由
    // 模型窗口均为 1048576（公开 /v1/models 同日），标 1M；opus 与 sonnet 相同，
    // 去重后只剩两条路由
    baseUrl: "https://router.huggingface.co",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "zai-org/GLM-5.3:baseten",
      "zai-org/GLM-5.3:baseten",
      "zai-org/GLM-5.3-Flash:baseten",
      true,
    ),
    endpointCandidates: ["https://router.huggingface.co"],
    icon: "huggingface",
  },
  {
    name: "Microsoft Foundry",
    websiteUrl: "https://azure.microsoft.com/en-us/products/ai-foundry",
    apiKeyUrl: "https://ai.azure.com/",
    category: "cloud_provider",
    // 同 Claude Code 预设：base 为 https://<资源名>.services.ai.azure.com/anthropic、
    // 不带 /v1，API Key 发 x-api-key（learn.microsoft.com/en-us/azure/foundry/
    // foundry-models/how-to/use-foundry-models-claude，2026-10-14 核对）。表单不支持
    // 模板变量，资源名用字面占位符（同 Codex 的 Azure OpenAI）。直连只能写 Bearer，
    // 文档只把 Bearer 写成 Entra token 的用法，故走路由，按 ANTHROPIC_API_KEY 发
    // x-api-key。上游填默认部署名（自定义了须同步改）；三个 5.5 模型窗口均为 1M
    //（learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/
    // claude-models 同日），标 1M
    baseUrl: "https://YOUR_RESOURCE_NAME.services.ai.azure.com/anthropic",
    apiKeyField: "ANTHROPIC_API_KEY",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: mappedRoutes(
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "claude-haiku-5-5",
      true,
    ),
    icon: "azure",
    iconColor: "#0078D4",
  },
  {
    name: "Fireworks AI",
    websiteUrl: "https://fireworks.ai",
    apiKeyUrl: "https://app.fireworks.ai/settings/users/api-keys",
    category: "cloud_provider",
    icon: "fireworks",
    // 同 Claude Code 预设：Anthropic 端点 base 不带 /v1，Bearer 鉴权，模型写全名
    //（docs.fireworks.ai/tools-sdks/anthropic-compatibility，2026-10-14 核对）；
    // 模型名非 Claude，只能走路由。官方给 Desktop 的只有本机网关 FireConnect
    //（docs.fireworks.ai/nexus/harnesses 同日），路由模式即替代它。三个路由
    // 模型窗口均 ≥ 1M（各模型页与 docs.fireworks.ai/serverless/pricing 同日），
    // 标 1M
    baseUrl: "https://api.fireworks.ai/inference",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "accounts/fireworks/models/glm-5p3",
      "accounts/fireworks/models/kimi-k3",
      "accounts/fireworks/models/deepseek-v4p1-flash",
      true,
    ),
    endpointCandidates: ["https://api.fireworks.ai/inference"],
  },
  {
    name: "Mistral AI",
    websiteUrl: "https://mistral.ai",
    apiKeyUrl: "https://console.mistral.ai/api-keys",
    category: "cn_official",
    // 同 Claude Code 预设：官方只文档化 OpenAI Chat 端点（docs.mistral.ai/
    // openapi.yaml，2026-10-14 核对），走 openai_chat 路由，base 不带 /v1。
    // Medium 3.5 / Small 4 窗口均为 256k（docs.mistral.ai/models.md 同日），
    // 不标 1M
    baseUrl: "https://api.mistral.ai",
    mode: "proxy",
    apiFormat: "openai_chat",
    modelRoutes: brandedRoutes(
      "mistral-medium-3-5",
      "mistral-medium-3-5",
      "mistral-small-2603",
    ),
    endpointCandidates: ["https://api.mistral.ai"],
    icon: "mistral",
    // 先隐藏：同 Claude 预设，转换层风险真 Key 冒烟通过前不展示
    hidden: true,
  },
  {
    name: "Cloudflare AI Gateway",
    websiteUrl: "https://developers.cloudflare.com/ai-gateway/",
    apiKeyUrl: "https://dash.cloudflare.com/profile/api-tokens",
    category: "cloud_provider",
    // 官方 Claude Desktop 接入页（developers.cloudflare.com/ai-gateway/
    // integrations/coding-agents/claude-desktop，2026-10-14 核对）：Gateway 连接、
    // 认证方式 Bearer、Key 填网关 token，base 为 …/v1/<账户 ID>/<网关 ID>/
    // anthropic、不带 /v1，不需要自定义头（Key 是自己的 Anthropic Key 时才另加
    // cf-aig-authorization）。上游是 Anthropic 原生透传，直连即可。表单不支持模板
    // 变量，账户 ID 用字面占位符（同 Codex 的 Azure OpenAI），网关 ID 填自动创建
    // 的 default，忘了改会 401
    baseUrl:
      "https://gateway.ai.cloudflare.com/v1/YOUR_ACCOUNT_ID/default/anthropic",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: passthroughRoutes(true),
    icon: "cloudflare",
  },
  {
    name: "Nvidia",
    websiteUrl: "https://build.nvidia.com",
    apiKeyUrl: "https://build.nvidia.com/settings/api-keys",
    category: "aggregator",
    baseUrl: "https://integrate.api.nvidia.com",
    mode: "proxy",
    apiFormat: "openai_chat",
    modelRoutes: brandedRoutes(
      "moonshotai/kimi-k2.6",
      "moonshotai/kimi-k2.6",
      "moonshotai/kimi-k2.6",
    ),
    icon: "nvidia",
    iconColor: "#000000",
  },
  {
    name: "PIPELLM",
    websiteUrl: "https://code.pipellm.ai",
    apiKeyUrl: "https://code.pipellm.ai/login?ref=uvw650za",
    category: "aggregator",
    baseUrl: "https://cc-api.pipellm.ai",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: passthroughRoutes(true),
    icon: "pipellm",
  },
  {
    name: "Xiaomi MiMo",
    family: "xiaomi-mimo",
    planKey: "payg",
    websiteUrl: "https://platform.xiaomimimo.com",
    apiKeyUrl: "https://platform.xiaomimimo.com/#/console/api-keys",
    category: "cn_official",
    baseUrl: "https://api.xiaomimimo.com/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "mimo-v2.6-pro",
      "mimo-v2.6-pro",
      "mimo-v2.6-pro",
      true,
    ),
    icon: "xiaomimimo",
    iconColor: "#000000",
  },
  {
    name: "Xiaomi MiMo Token Plan (China)",
    family: "xiaomi-mimo",
    planKey: "tokenPlan",
    websiteUrl: "https://platform.xiaomimimo.com/#/token-plan",
    apiKeyUrl: "https://platform.xiaomimimo.com/#/console/plan-manage",
    category: "cn_official",
    baseUrl: "https://token-plan-cn.xiaomimimo.com/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: brandedRoutes(
      "mimo-v2.6-pro",
      "mimo-v2.6-pro",
      "mimo-v2.6-pro",
      true,
    ),
    icon: "xiaomimimo",
    iconColor: "#000000",
  },
  {
    name: "JieKou AI",
    websiteUrl: "https://jiekou.ai/#model-library",
    apiKeyUrl: "https://jiekou.ai/settings/key-management",
    category: "aggregator",
    baseUrl: "https://api.jiekou.ai/anthropic",
    mode: "proxy",
    apiFormat: "anthropic",
    modelRoutes: [
      {
        routeId: CLAUDE_DESKTOP_ROLE_ROUTE_IDS.fable,
        upstreamModel: "claude-fable-5-1",
        supports1m: true,
      },
    ],
    endpointCandidates: ["https://api.jiekou.ai/anthropic"],
    icon: "jiekou",
    iconColor: "#000000",
  },
  {
    name: "AICodeWith",
    websiteUrl: "https://aicodewith.ai",
    apiKeyUrl: "https://aicodewith.ai/login?tab=register",
    category: "aggregator",
    baseUrl: "https://api.aicodewith.ai",
    mode: "proxy",
    apiFormat: "anthropic",
    // 上游模型 ID 与角色路由 ID（claude-sonnet-5 / claude-haiku-4-5）不同，
    // 故用 mappedRoutes 显式映射而非 passthroughRoutes。
    modelRoutes: mappedRoutes(
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "claude-haiku-5-5",
      true,
    ),
    endpointCandidates: ["https://api.aicodewith.ai"],
    icon: "aicodewith",
    iconColor: "#3A3B40",
  },
  {
    name: "SoruxGPT",
    websiteUrl: "https://ai.soruxgpt.com",
    apiKeyUrl: "https://ai.soruxgpt.com/console/token",
    category: "aggregator",
    baseUrl: "https://ai.soruxgpt.com",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: mappedRoutes(
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "claude-haiku-5-5",
      true,
    ),
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
    category: "aggregator",
    baseUrl: "https://api.ikuncode.ai",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: mappedRoutes(
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "claude-haiku-5-5",
      true,
    ),
    endpointCandidates: ["https://api.ikuncode.ai", "https://api.ikuncode.cc"],
    icon: "ikuncode",
  },
  {
    name: "RunToken",
    websiteUrl: "https://www.runtoken.ai",
    apiKeyUrl: "https://www.runtoken.ai/console/token",
    category: "aggregator",
    baseUrl: "https://www.runtoken.ai",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: mappedRoutes(
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "claude-haiku-5-5",
      true,
    ),
    endpointCandidates: ["https://www.runtoken.ai", "https://fast.runtoken.ai"],
    icon: "runtoken",
  },
  {
    name: "BotCF",
    websiteUrl: "https://botcf.com",
    apiKeyUrl: "https://botcf.com/console/token",
    category: "aggregator",
    baseUrl: "https://botcf.com",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: mappedRoutes(
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "claude-haiku-5-5",
      true,
    ),
    icon: "botcf",
  },
  {
    name: "YYLX",
    nameKey: "providerForm.presets.yylx",
    websiteUrl: "https://yylx.io",
    apiKeyUrl: "https://app.yylx.io/keys",
    category: "aggregator",
    baseUrl: "https://app.yylx.io",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: mappedRoutes(
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "claude-haiku-5-5",
      true,
    ),
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
    category: "aggregator",
    baseUrl: "https://tokenflux.dev",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: mappedRoutes(
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "claude-haiku-5-5",
      true,
    ),
    icon: "tokenflux",
  },
  {
    name: "NekoCode",
    websiteUrl: "https://nekoapi.ai",
    apiKeyUrl: "https://nekoapi.ai/token",
    category: "aggregator",
    baseUrl: "https://nekoapi.ai",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: mappedRoutes(
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "claude-haiku-5-5",
      true,
    ),
    icon: "nekocode",
  },
  {
    name: "AIComing",
    websiteUrl: "https://aicoming.top",
    apiKeyUrl: "https://aicoming.top/console#keys",
    category: "aggregator",
    baseUrl: "https://api.aicoming.top",
    mode: "direct",
    apiFormat: "anthropic",
    modelRoutes: mappedRoutes(
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "claude-haiku-5-5",
      true,
    ),
    icon: "aicoming",
  },
];
