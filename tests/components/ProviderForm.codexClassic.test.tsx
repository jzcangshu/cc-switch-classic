import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { parse } from "smol-toml";
import {
  ProviderForm,
  type ProviderFormValues,
} from "@/components/providers/forms/ProviderForm";
import { createTestQueryClient } from "../utils/testQueryClient";

vi.mock("@/components/providers/forms/CodexConfigEditor", () => ({
  default: () => null,
}));
vi.mock("@/components/providers/forms/hooks", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/providers/forms/hooks")>();
  const signedOut = {
    isAuthenticated: false,
    isStatusSuccess: true,
    isStatusError: false,
    accounts: [],
  };
  return {
    ...actual,
    useCopilotAuth: () => signedOut,
    useCodexOauth: () => signedOut,
    useXaiOauth: () => signedOut,
  };
});

const config =
  'model_provider = "custom"\nmodel = "m-main"\nmodel_context_window = 200000\nmodel_auto_compact_token_limit = 180000\n\n[model_providers.custom]\nname = "custom"\nbase_url = "https://relay.example/v1"\nwire_api = "responses"\nexperimental_bearer_token = "synthetic-fixture"\n\n[agents]\ndefault_subagent_model = "m-small"\ndefault_subagent_reasoning_effort = "low"\n';
const catalog = {
  models: [
    {
      model: "m-small",
      displayName: "Small",
      contextWindow: 128000,
      supportsParallelToolCalls: false,
      inputModalities: ["text"],
      baseInstructions: "Keep this instruction.",
      reasoningLevels: ["low", "high"],
      defaultReasoningLevel: "low",
    },
    {
      model: "m-main",
      displayName: "Main",
      contextWindow: 200000,
      supportsParallelToolCalls: true,
      inputModalities: ["text", "image"],
    },
  ],
  autoReviewModel: "m-small",
};

function renderProvider(withCatalog: boolean) {
  const onSubmit = vi.fn();
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProviderForm
        appId="codex"
        modeView="direct"
        providerId="relay"
        submitLabel="save-provider"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        initialData={{
          name: "Relay",
          category: "third_party",
          meta: { apiFormat: "openai_responses" },
          settingsConfig: {
            auth: {},
            config,
            ...(withCatalog ? { modelCatalog: catalog } : {}),
          },
        }}
      />
    </QueryClientProvider>,
  );
  return onSubmit;
}

async function save(onSubmit: ReturnType<typeof vi.fn>) {
  fireEvent.click(screen.getByRole("button", { name: "save-provider" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  const values = onSubmit.mock.calls[0][0] as ProviderFormValues;
  return JSON.parse(values.settingsConfig);
}

const advanced = () => screen.getByRole("button", { name: "高级选项" });

describe("Codex classic layout upgrade compatibility", () => {
  it("keeps an existing catalog, hidden metadata, approval model and native config when saved collapsed", async () => {
    const onSubmit = renderProvider(true);
    expect(document.getElementById("codexDefaultModel")).toHaveValue("m-main");
    expect(advanced()).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(advanced());
    expect(screen.queryByText("模型映射（可选）")).toBeNull();
    const saved = await save(onSubmit);
    expect(saved.modelCatalog).toEqual(catalog);
    expect(parse(saved.config)).toEqual(parse(config));
    expect(saved.auth).toEqual({});
  });

  it("keeps a provider without mappings on the native model list after opening and closing advanced options", async () => {
    const onSubmit = renderProvider(false);
    expect(advanced()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(advanced());
    fireEvent.click(advanced());
    const saved = await save(onSubmit);
    expect(saved.modelCatalog).toBeUndefined();
    expect(parse(saved.config)).toEqual(parse(config));
  });

  it("changing the independent default model preserves catalog order and other metadata", async () => {
    const onSubmit = renderProvider(true);
    fireEvent.change(document.getElementById("codexDefaultModel")!, {
      target: { value: "m-small" },
    });
    const saved = await save(onSubmit);
    expect(saved.modelCatalog).toEqual(catalog);
    expect(parse(saved.config)).toEqual({ ...parse(config), model: "m-small" });
  });
});
