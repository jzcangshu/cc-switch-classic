import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MIN_REFRESH_SPIN_MS,
  QuotaBars,
  QuotaLines,
  REFRESH_RESULT_MS,
} from "@/components/quota/QuotaLines";
import { failedLines, type QuotaLine } from "@/components/quota/quotaRules";
import type { TFunction } from "i18next";

const t = ((key: string) => key) as unknown as TFunction;
const lines: QuotaLine[] = [
  {
    key: "five_hour",
    text: "5 小时剩余 82%",
    value: "剩余 82%",
    label: "5 小时",
    emphasis: "82%",
    tone: "normal",
    left: 82,
  },
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const icon = () => screen.queryByTestId("quota-refresh-icon");
const isSpinning = () =>
  icon()?.classList.contains("motion-safe:animate-spin") ?? false;
const result = () =>
  screen.queryByTestId("quota-refresh-succeeded")
    ? "✓"
    : screen.queryByTestId("quota-refresh-failed")
      ? "✗"
      : null;

/** 让 refetch() 的 Promise 落定 */
const flush = () => act(async () => await Promise.resolve());

describe("quota column refresh", () => {
  it("keeps the refresh icon and update time visible without hovering", () => {
    render(<QuotaLines lines={lines} onRefresh={vi.fn()} />);
    expect(icon()).not.toHaveClass("hidden");
    expect(screen.getByTestId("quota-update-clock")).toBeInTheDocument();
    expect(screen.getByText("从未更新")).toBeInTheDocument();
    expect(isSpinning()).toBe(false);
  });

  it("spins from the click until the query is done, then ticks for a moment", () => {
    const onRefresh = vi.fn();
    const { rerender } = render(
      <QuotaLines lines={lines} onRefresh={onRefresh} />,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(isSpinning()).toBe(true);

    // 查询还在跑：过了最短时长也继续转，且不能再点
    rerender(<QuotaLines lines={lines} onRefresh={onRefresh} loading />);
    act(() => vi.advanceTimersByTime(MIN_REFRESH_SPIN_MS * 2));
    expect(isSpinning()).toBe(true);
    expect(screen.getByRole("button")).toBeDisabled();
    // 转圈时再点不会重复查
    fireEvent.click(screen.getByRole("button"));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // 查完 → ✓，停一会儿再消失
    rerender(<QuotaLines lines={lines} onRefresh={onRefresh} />);
    act(() => vi.advanceTimersByTime(0));
    expect(result()).toBe("✓");
    act(() => vi.advanceTimersByTime(REFRESH_RESULT_MS));
    expect(result()).toBeNull();
    expect(isSpinning()).toBe(false);
  });

  it("restores the visible refresh control after its result clears", () => {
    render(<QuotaLines lines={lines} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    act(() => vi.advanceTimersByTime(MIN_REFRESH_SPIN_MS));
    act(() => vi.advanceTimersByTime(REFRESH_RESULT_MS));
    expect(icon()).not.toHaveClass("hidden");
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("keeps spinning for the minimum time when the query returns at once", () => {
    render(<QuotaLines lines={lines} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));

    act(() => vi.advanceTimersByTime(MIN_REFRESH_SPIN_MS - 1));
    expect(isSpinning()).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result()).toBe("✓");
  });

  it("crosses when the column turns into a failure", () => {
    const { rerender } = render(
      <QuotaLines lines={lines} onRefresh={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button"));
    rerender(
      <QuotaLines lines={failedLines(t, "HTTP 500")} onRefresh={vi.fn()} />,
    );
    act(() => vi.advanceTimersByTime(MIN_REFRESH_SPIN_MS));
    expect(result()).toBe("✗");
  });

  it("crosses a failed retry even when the column already showed the failure", () => {
    const failed = failedLines(t, "HTTP 500");
    render(<QuotaLines lines={failed} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    act(() => vi.advanceTimersByTime(MIN_REFRESH_SPIN_MS));
    expect(result()).toBe("✗");
  });

  it("crosses when the request failed but the last good quota is still shown", async () => {
    render(
      <QuotaLines
        lines={lines}
        onRefresh={() => Promise.resolve({ isError: true })}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    await flush();
    act(() => vi.advanceTimersByTime(MIN_REFRESH_SPIN_MS));
    expect(result()).toBe("✗");
  });

  it("shows failed feedback for a business failure while the last good quota remains", async () => {
    render(
      <QuotaLines
        lines={lines}
        onRefresh={() =>
          Promise.resolve({ isError: false, data: { success: false } })
        }
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    await flush();
    act(() => vi.advanceTimersByTime(MIN_REFRESH_SPIN_MS));
    expect(result()).toBe("✗");
    expect(screen.getByText("82%")).toBeInTheDocument();
  });

  it("shows failed feedback when the refresh promise rejects", async () => {
    render(
      <QuotaLines
        lines={lines}
        onRefresh={() => Promise.reject(new Error("请求失败"))}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    await flush();
    act(() => vi.advanceTimersByTime(MIN_REFRESH_SPIN_MS));
    expect(result()).toBe("✗");
  });

  it("waits for the refetch promise before deciding", async () => {
    let resolve!: (value: unknown) => void;
    render(
      <QuotaLines
        lines={lines}
        onRefresh={() => new Promise((r) => (resolve = r))}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    act(() => vi.advanceTimersByTime(MIN_REFRESH_SPIN_MS * 3));
    expect(isSpinning()).toBe(true);

    resolve({ isError: false });
    await flush();
    act(() => vi.advanceTimersByTime(0));
    expect(result()).toBe("✓");
  });

  it("does not spin for background refreshes, only dims", () => {
    render(<QuotaLines lines={lines} onRefresh={vi.fn()} loading />);
    expect(isSpinning()).toBe(false);
    expect(screen.getByRole("button").closest("div[title]")).toHaveClass(
      "opacity-60",
    );
  });

  it("shows the classic alert icon with a query failure", () => {
    const { container } = render(
      <QuotaLines
        lines={failedLines(t, "查询端点不可用")}
        onRefresh={vi.fn()}
      />,
    );
    expect(container.querySelector(".lucide-circle-alert")).toHaveClass(
      "text-red-500",
    );
    // 原因与「查询失败」合并成同一行（卡片高度与普通卡对齐）；
    // 根容器与徽章 span 的 textContent 相同，取最小的那个匹配断言
    const matches = screen.getAllByText(
      (_, el) => el?.textContent === "quota.failed：查询端点不可用",
    );
    expect(matches.length).toBeGreaterThan(0);
  });

  it("shows no icon when the quota cannot be refreshed", () => {
    render(<QuotaLines lines={lines} />);
    expect(icon()).toBeNull();
    expect(result()).toBeNull();
  });

  it("keeps reset details separate from refreshing and stops card click propagation", () => {
    const onRefresh = vi.fn();
    const withResets: QuotaLine[] = [
      { ...lines[0], short: "5 小时 82%", window: 0 },
      {
        key: "seven_day",
        text: "每周剩余 64%",
        short: "每周 64%",
        tone: "normal",
        left: 64,
        window: 2,
      },
      {
        key: "reset_credits",
        text: "重置剩余 3 次",
        short: "重置 3 次",
        tone: "normal",
        left: Infinity,
        window: 99,
        breakdown: {
          title: "存下的限额重置",
          openLabel: "查看到期时间",
          items: [],
        },
      },
    ];
    const onCardClick = vi.fn();
    render(
      <div onClick={onCardClick}>
        <QuotaLines lines={withResets} onRefresh={onRefresh} />
      </div>,
    );

    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(icon()).not.toHaveClass("hidden");

    fireEvent.click(screen.getByRole("button", { name: "查看到期时间" }));
    expect(
      screen.getByRole("dialog", { name: "存下的限额重置" }),
    ).toBeInTheDocument();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(onCardClick).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "quota.clickToRefresh" }),
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onCardClick).not.toHaveBeenCalled();
  });
});

describe("expanded quota bars", () => {
  it("writes the reset countdown after the value", () => {
    vi.setSystemTime(new Date("2026-10-04T10:00:00Z"));
    render(
      <QuotaBars
        rows={[
          {
            label: "5 小时",
            line: {
              key: "five_hour",
              text: "5 小时剩余 69%",
              value: "剩余 69%",
              tone: "normal",
              left: 69,
              label: "5 小时",
              resetsAt: "2026-10-04T12:30:00Z",
            },
          },
        ]}
      />,
    );
    // 测试里 t() 返回 key
    expect(screen.getByText("subscription.resetsIn")).toBeInTheDocument();
  });
});

describe("reset countdown on the card", () => {
  it("uses available width and shows each tier's countdown without empty slots", () => {
    vi.setSystemTime(new Date("2026-10-04T10:00:00Z"));
    const { container, rerender } = render(<QuotaLines lines={lines} />);
    expect(container.firstElementChild).not.toHaveClass(
      "w-[136px]",
      "w-[194px]",
      "w-[208px]",
    );
    expect(screen.getByTestId("quota-update-clock")).toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(1);

    rerender(
      <QuotaLines
        lines={[{ ...lines[0], resetsAt: "2026-10-04T12:30:00Z" }]}
      />,
    );
    expect(container.firstElementChild).not.toHaveClass(
      "w-[136px]",
      "w-[194px]",
      "w-[208px]",
    );
    expect(screen.getByText("2h30m")).toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(2);
  });
});
