import { describe, expect, it } from "vitest";
import { providerPresets } from "@/config/claudeProviderPresets";
import { GPT_CONTEXT_WINDOW_CAP } from "@/lib/modelMetadata";

describe("Kimi For Coding Provider Preset", () => {
  const kimiForCoding = providerPresets.find(
    (p) => p.name === "Kimi For Coding",
  );

  it("should include Kimi For Coding preset", () => {
    expect(kimiForCoding).toBeDefined();
  });

  // CLAUDE_CODE_MAX_CONTEXT_TOKENS is ignored for claude-* model ids, so the
  // preset must route the endpoint's own alias for the context envs to bite
  it("should route the kimi-for-coding model id on every tier", () => {
    const env = (kimiForCoding!.settingsConfig as any).env;
    expect(env).toMatchObject({
      ANTHROPIC_MODEL: "kimi-for-coding",
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "kimi-for-coding",
      ANTHROPIC_DEFAULT_SONNET_MODEL: "kimi-for-coding",
      ANTHROPIC_DEFAULT_OPUS_MODEL: "kimi-for-coding",
    });
  });

  // 预设直接钉值，不再暴露表单输入框；要调整的用户直接改 JSON 编辑框
  it("should pin the 256K context envs without exposing form fields", () => {
    const env = (kimiForCoding!.settingsConfig as any).env;
    expect(env.CLAUDE_CODE_MAX_CONTEXT_TOKENS).toBe("262144");
    expect(env.CLAUDE_CODE_AUTO_COMPACT_WINDOW).toBe("262144");
    expect(kimiForCoding!.templateValues).toBeUndefined();
  });
});

describe("Codex Provider Preset", () => {
  const codex = providerPresets.find((p) => p.name === "Codex");

  it("should include the Codex preset", () => {
    expect(codex).toBeDefined();
  });

  // 预设直接钉 Codex 订阅目录的 272K 窗口（与 GPT_CONTEXT_WINDOW_CAP 一致），不暴露表单输入框
  it("should pin the Codex-catalog 272K window without exposing form fields", () => {
    const env = (codex!.settingsConfig as any).env;
    expect(env.CLAUDE_CODE_MAX_CONTEXT_TOKENS).toBe(
      String(GPT_CONTEXT_WINDOW_CAP),
    );
    expect(env.CLAUDE_CODE_AUTO_COMPACT_WINDOW).toBe(
      String(GPT_CONTEXT_WINDOW_CAP),
    );
    expect(codex!.templateValues).toBeUndefined();
  });
});

describe("OpenCode Zen Provider Preset", () => {
  const openCodeZen = providerPresets.find((p) => p.name === "OpenCode Zen");

  it("should connect Claude models to Zen /messages directly with x-api-key auth", () => {
    expect(openCodeZen).toBeDefined();
    expect(openCodeZen!.family).toBe("opencode");

    const env = (openCodeZen!.settingsConfig as any).env;
    expect(env.ANTHROPIC_BASE_URL).toBe("https://opencode.ai/zen");
    // 和 Go 同一套网关：/messages 只认 x-api-key
    expect(env).not.toHaveProperty("ANTHROPIC_AUTH_TOKEN");
    expect(openCodeZen!.apiKeyField).toBe("ANTHROPIC_API_KEY");
    expect(openCodeZen!.apiFormat).toBeUndefined();
    // 免费模型外部调用会被 403，默认模型不能是 *-free / big-pickle
    for (const key of [
      "ANTHROPIC_MODEL",
      "ANTHROPIC_DEFAULT_HAIKU_MODEL",
      "ANTHROPIC_DEFAULT_SONNET_MODEL",
      "ANTHROPIC_DEFAULT_OPUS_MODEL",
    ]) {
      expect(env[key]).toMatch(/^claude-/);
    }
  });
});

describe("AWS Bedrock Provider Presets", () => {
  const bedrockAksk = providerPresets.find(
    (p) => p.name === "AWS Bedrock (AKSK)",
  );

  it("should include AWS Bedrock (AKSK) preset", () => {
    expect(bedrockAksk).toBeDefined();
  });

  it("AKSK preset should have required AWS env variables", () => {
    const env = (bedrockAksk!.settingsConfig as any).env;
    expect(env).toHaveProperty("AWS_ACCESS_KEY_ID");
    expect(env).toHaveProperty("AWS_SECRET_ACCESS_KEY");
    expect(env).toHaveProperty("AWS_REGION");
    expect(env).toHaveProperty("CLAUDE_CODE_USE_BEDROCK", "1");
  });

  it("AKSK preset should have template values for AWS credentials", () => {
    expect(bedrockAksk!.templateValues).toBeDefined();
    expect(bedrockAksk!.templateValues!.AWS_ACCESS_KEY_ID).toBeDefined();
    expect(bedrockAksk!.templateValues!.AWS_SECRET_ACCESS_KEY).toBeDefined();
    expect(bedrockAksk!.templateValues!.AWS_REGION).toBeDefined();
    expect(bedrockAksk!.templateValues!.AWS_REGION.editorValue).toBe(
      "us-west-2",
    );
  });

  it("AKSK preset should have correct base URL template", () => {
    const env = (bedrockAksk!.settingsConfig as any).env;
    expect(env.ANTHROPIC_BASE_URL).toContain("bedrock-runtime");
    expect(env.ANTHROPIC_BASE_URL).toContain("${AWS_REGION}");
  });

  it("AKSK preset should have cloud_provider category", () => {
    expect(bedrockAksk!.category).toBe("cloud_provider");
  });

  it("AKSK preset should have Bedrock model as default", () => {
    const env = (bedrockAksk!.settingsConfig as any).env;
    expect(env.ANTHROPIC_MODEL).toContain("anthropic.claude");
  });

  const bedrockApiKey = providerPresets.find(
    (p) => p.name === "AWS Bedrock (API Key)",
  );

  it("should include AWS Bedrock (API Key) preset", () => {
    expect(bedrockApiKey).toBeDefined();
  });

  // Claude Code 只从 AWS_BEARER_TOKEN_BEDROCK 读 Bedrock API Key，顶层 apiKey 不生效
  it("API Key preset should carry the key in AWS_BEARER_TOKEN_BEDROCK", () => {
    const config = bedrockApiKey!.settingsConfig as any;
    expect(config).not.toHaveProperty("apiKey");
    expect(config.env).toHaveProperty("AWS_BEARER_TOKEN_BEDROCK", "");
    expect(config.env).toHaveProperty("AWS_REGION");
    expect(config.env).toHaveProperty("CLAUDE_CODE_USE_BEDROCK", "1");
  });

  it("API Key preset should NOT have AKSK env variables", () => {
    const env = (bedrockApiKey!.settingsConfig as any).env;
    expect(env).not.toHaveProperty("AWS_ACCESS_KEY_ID");
    expect(env).not.toHaveProperty("AWS_SECRET_ACCESS_KEY");
  });

  it("API Key preset should have template values for region only", () => {
    expect(bedrockApiKey!.templateValues).toBeDefined();
    expect(bedrockApiKey!.templateValues!.AWS_REGION).toBeDefined();
    expect(bedrockApiKey!.templateValues!.AWS_REGION.editorValue).toBe(
      "us-west-2",
    );
  });

  it("API Key preset should have cloud_provider category", () => {
    expect(bedrockApiKey!.category).toBe("cloud_provider");
  });
});

describe("Microsoft Foundry Provider Preset", () => {
  const foundry = providerPresets.find((p) => p.name === "Microsoft Foundry");

  it("lets the user fill the Azure resource name into the base URL", () => {
    const env = (foundry!.settingsConfig as any).env;
    expect(foundry!.templateValues!.AZURE_RESOURCE_NAME).toBeDefined();
    expect(env.ANTHROPIC_BASE_URL).toBe(
      "https://${AZURE_RESOURCE_NAME}.services.ai.azure.com/anthropic",
    );
  });

  // 官方文档的 API Key 走 x-api-key
  it("sends the key as x-api-key", () => {
    const env = (foundry!.settingsConfig as any).env;
    expect(foundry!.apiKeyField).toBe("ANTHROPIC_API_KEY");
    expect(env).toHaveProperty("ANTHROPIC_API_KEY", "");
    expect(env).not.toHaveProperty("ANTHROPIC_AUTH_TOKEN");
  });
});
