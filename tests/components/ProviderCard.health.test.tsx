import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderCard } from "@/components/providers/ProviderCard";
import type { Provider } from "@/types";
import type { ProviderHealth } from "@/types/proxy";
import { createTestQueryClient } from "../utils/testQueryClient";

const useProviderHealth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/query/failover", () => ({ useProviderHealth }));
vi.mock("@/lib/query/queries", () => ({
  useUsageQuery: () => ({ data: undefined }),
}));
vi.mock("@/components/providers/ProviderCardActions", () => ({
  ProviderCardActions: () => null,
}));
vi.mock("@/components/ProviderIcon", () => ({ ProviderIcon: () => null }));
vi.mock("@/components/UsageFooter", () => ({ default: () => null }));
vi.mock("@/components/SubscriptionQuotaFooter", () => ({
  default: () => null,
}));
vi.mock("@/components/CopilotQuotaFooter", () => ({ default: () => null }));
vi.mock("@/components/CodexOauthQuotaFooter", () => ({ default: () => null }));
vi.mock("@/components/XaiOauthQuotaFooter", () => ({ default: () => null }));
vi.mock("@/components/AgyAccountQuotaFooter", () => ({ default: () => null }));

const provider: Provider = {
  id: "relay",
  name: "Relay",
  settingsConfig: { env: { ANTHROPIC_API_KEY: "test" } },
};

function renderHealth(
  consecutiveFailures: number,
  isHealthy: boolean,
  showHealth = true,
) {
  const health: ProviderHealth = {
    provider_id: provider.id,
    app_type: "claude",
    consecutive_failures: consecutiveFailures,
    is_healthy: isHealthy,
    last_success_at: null,
    last_failure_at: null,
    last_error: null,
    updated_at: "2026-10-23T00:00:00Z",
  };
  useProviderHealth.mockReturnValue({ data: health });
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ProviderCard
        provider={provider}
        appId="claude"
        isCurrent={false}
        presentation={{ chips: [], buttons: [], showHealth }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onConfigureUsage={vi.fn()}
        onOpenWebsite={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("ProviderCard health badge", () => {
  it.each([
    [0, false, "health.operational"],
    [2, true, "health.degraded"],
    [3, false, "health.circuitOpen"],
  ] as const)(
    "shows the backend health state for %i failures",
    (failures, healthy, label) => {
      renderHealth(failures, healthy);
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(label)).toHaveAttribute(
        "title",
        "health.consecutiveFailures",
      );
      expect(useProviderHealth).toHaveBeenCalledWith(
        provider.id,
        "claude",
        true,
      );
    },
  );

  it("hides cached health when the presentation no longer requests it", () => {
    renderHealth(3, false, false);
    expect(screen.queryByText("health.circuitOpen")).not.toBeInTheDocument();
    expect(useProviderHealth).toHaveBeenCalledWith(
      provider.id,
      "claude",
      false,
    );
  });
});
