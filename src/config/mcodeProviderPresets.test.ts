import { describe, expect, it } from "vitest";
import { mcodeProviderPresets } from "./mcodeProviderPresets";
import { piProviderPresets } from "./piProviderPresets";

const mcodePreset = (name: string) =>
  mcodeProviderPresets.find((preset) => preset.name === name);
const piPreset = (name: string) =>
  piProviderPresets.find((preset) => preset.name === name)!;

describe("mcodeProviderPresets", () => {
  it("passes Pi's model compat through verbatim but never its thinkingLevelMap", () => {
    for (const preset of mcodeProviderPresets) {
      const piModels = piPreset(preset.name).settingsConfig.models;
      for (const [id, model] of Object.entries(preset.settingsConfig.models)) {
        const piModel = piModels.find((candidate) => candidate.id === id)!;
        expect(model.compat, `${preset.name}/${id}`).toEqual(piModel.compat);
        expect(model, `${preset.name}/${id}`).not.toHaveProperty(
          "thinkingLevelMap",
        );
      }
    }
  });

  it("skips only the models whose compat MCode cannot express", () => {
    const models = Object.keys(mcodePreset("Kimi")!.settingsConfig.models);
    expect(models).toContain("kimi-k2.7-code");
    expect(models).not.toContain("kimi-k3");
    expect(
      piPreset("Kimi").settingsConfig.models.map((model) => model.id),
    ).toContain("kimi-k3");
  });

  it("inherits both Volcengine plans with their own endpoints", () => {
    const baseUrl = (name: string) =>
      mcodePreset(name)?.settingsConfig.options.baseURL;
    expect(baseUrl("火山 Agent Plan")).toBe(
      "https://ark.cn-beijing.volces.com/api/plan/v3",
    );
    expect(baseUrl("火山 Coding Plan")).toBe(
      "https://ark.cn-beijing.volces.com/api/coding/v3",
    );
  });

  it("excludes presets on APIs MCode does not support", () => {
    expect(mcodePreset("AWS Bedrock")).toBeUndefined();
  });
});
