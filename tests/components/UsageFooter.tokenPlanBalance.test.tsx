import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import UsageFooter from "@/components/UsageFooter";
import { usageApi } from "@/lib/api/usage";
import { usageKeys } from "@/lib/query/usage";
import type { Provider, UsageResult } from "@/types";
import { createTestQueryClient } from "../utils/testQueryClient";

function renderFooter(result: UsageResult, inline = false) {
  const provider: Provider = {
    id: "zhipu",
    name: "Zhipu GLM",
    settingsConfig: {
      env: { ANTHROPIC_BASE_URL: "https://open.bigmodel.cn/api/anthropic" },
    },
    meta: {
      usage_script: {
        enabled: true,
        language: "javascript",
        code: "",
        templateType: "token_plan",
      },
    },
  };
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(usageKeys.script(provider.id, "claude"), result);
  return render(
    <QueryClientProvider client={queryClient}>
      <UsageFooter
        provider={provider}
        providerId={provider.id}
        appId="claude"
        usageEnabled={true}
        isCurrent={true}
        inline={inline}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("UsageFooter token plan", () => {
  // 智谱按量账户没有 Coding Plan 时，后端回落成账户余额（#8465）
  it("shows a balance when the token plan query falls back to the account balance", () => {
    renderFooter({
      success: true,
      data: [{ planName: "Zhipu GLM", remaining: 14.68, unit: "CNY" }],
    });

    expect(screen.getByText("Zhipu GLM")).toBeInTheDocument();
    expect(screen.getByText("quota.balance")).toBeInTheDocument();
    expect(screen.queryByText("quota.failed")).not.toBeInTheDocument();
  });

  it("keeps rendering percentage tiers for plan accounts", () => {
    renderFooter({
      success: true,
      data: [
        {
          planName: "five_hour",
          total: 100,
          used: 20,
          remaining: 80,
          unit: "%",
        },
      ],
    });

    expect(screen.queryByText("quota.balance")).not.toBeInTheDocument();
    expect(screen.queryByText("Zhipu GLM")).not.toBeInTheDocument();
  });
  it("keeps token plan badges, update time and refresh visible and calls the query", async () => {
    const result: UsageResult = {
      success: true,
      data: [{ planName: "five_hour", used: 20, remaining: 80, unit: "%" }],
    };
    const query = vi.spyOn(usageApi, "query").mockResolvedValue(result);
    renderFooter(result, true);

    expect(screen.getByText("subscription.fiveHour:")).toBeInTheDocument();
    expect(screen.getByTestId("quota-update-clock")).toBeInTheDocument();
    expect(screen.getByTestId("quota-refresh-icon")).not.toHaveClass("hidden");
    fireEvent.click(
      screen.getByRole("button", { name: "quota.clickToRefresh" }),
    );
    await waitFor(() => expect(query).toHaveBeenCalledWith("zhipu", "claude"));
  });

  it("keeps a failed script query visible with its reason and a working retry", async () => {
    const result: UsageResult = { success: false, error: "查询端点不可用" };
    const query = vi.spyOn(usageApi, "query").mockResolvedValue(result);
    const { container } = renderFooter(result, true);

    // 第三版形态：卡片上是「查询失败」胶囊，完整原因放悬停提示
    expect(screen.getByText("usage.queryFailed")).toBeInTheDocument();
    expect(
      container.querySelector('[title="查询端点不可用"]'),
    ).not.toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "usage.refreshUsage" }),
    );
    await waitFor(() => expect(query).toHaveBeenCalledWith("zhipu", "claude"));
  });

  it("keeps the full reason and retry control on an expanded failure", () => {
    renderFooter({ success: false, error: "查询端点不可用" });
    // 展开视图完整显示错误原因（第三版形态）
    expect(screen.getByText("查询端点不可用")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "usage.refreshUsage" }),
    ).toBeInTheDocument();
  });
});
