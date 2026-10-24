import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { settingsApi } from "@/lib/api";

import { SkillsPage } from "@/components/skills/SkillsPage";
import type {
  DiscoverableSkill,
  InstalledSkill,
  SkillRepo,
  SkillRepoFailure,
  SkillsShDiscoverableSkill,
  SkillsShSearchResult,
} from "@/lib/api/skills";
import type { AppId } from "@/lib/api/types";

const m = vi.hoisted(() => ({
  install: vi.fn(),
  addRepo: vi.fn(),
  refetchDiscoverable: vi.fn(),
  discoverable: [] as DiscoverableSkill[],
  failures: [] as SkillRepoFailure[],
  installed: [] as InstalledSkill[],
  repos: [] as SkillRepo[],
}));

// 同一个 query 返回同一个对象，否则 useEffect([skillsShResult]) 会无限 setState
const searchCache = new Map<
  string,
  {
    data: SkillsShSearchResult | undefined;
    isLoading: boolean;
    isFetching: boolean;
    isPlaceholderData?: boolean;
    isError?: boolean;
    refetch?: () => void;
  }
>();

const setSearchResult = (
  query: string,
  offset: number,
  result: SkillsShSearchResult | undefined,
  state: Partial<{
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    refetch: () => void;
  }> = {},
) => {
  searchCache.set(`${query}:${offset}`, {
    data: result,
    isLoading: false,
    isFetching: false,
    ...state,
  });
};

// 保留真正的虚拟列表，只为 jsdom 提供容器和卡片行尺寸。
let viewportWidth = 500;
let rowHeights: Record<number, number> = {};
const resizeObservers = new Set<{
  callback: ResizeObserverCallback;
  targets: Set<Element>;
  observer: ResizeObserver;
}>();
function notifyResize(target: Element) {
  for (const item of [...resizeObservers]) {
    if (!item.targets.has(target)) continue;
    item.callback(
      [
        {
          target,
          borderBoxSize: [
            {
              inlineSize: (target as HTMLElement).offsetWidth,
              blockSize: (target as HTMLElement).offsetHeight,
            },
          ],
        } as unknown as ResizeObserverEntry,
      ],
      item.observer,
    );
  }
}

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/hooks/useSkills", () => ({
  useDiscoverableSkills: () => ({
    data: m.discoverable,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: m.refetchDiscoverable,
  }),
  useDiscoverableSkillsFailures: () => ({ data: m.failures }),
  useInstalledSkills: () => ({ data: m.installed, isLoading: false }),
  useInstallSkill: () => ({ mutateAsync: m.install }),
  useSkillRepos: () => ({ data: m.repos, isLoading: false, refetch: vi.fn() }),
  useAddSkillRepo: () => ({ mutateAsync: m.addRepo }),
  useRemoveSkillRepo: () => ({ mutateAsync: vi.fn() }),
  useSearchSkillsSh: (query: string, _limit: number, offset: number) =>
    searchCache.get(`${query}:${offset}`) ?? {
      data: undefined,
      isLoading: false,
      isFetching: false,
    },
}));

const makeSkillsSh = (
  overrides: Partial<SkillsShDiscoverableSkill> = {},
): SkillsShDiscoverableSkill => ({
  key: "agent-browser:owner-a:repo-a",
  name: "Agent Browser",
  directory: "agent-browser",
  repoOwner: "owner-a",
  repoName: "repo-a",
  repoBranch: "main",
  installs: 12300,
  readmeUrl: "https://example.com/a",
  ...overrides,
});

const makeDiscoverable = (
  overrides: Partial<DiscoverableSkill> = {},
): DiscoverableSkill => ({
  key: "repo-skill:owner-a:repo-a",
  name: "repo-skill",
  description: "Skill from a configured repository",
  directory: "repo-skill",
  repoOwner: "owner-a",
  repoName: "repo-a",
  repoBranch: "main",
  ...overrides,
});

const makeRepo = (overrides: Partial<SkillRepo> = {}): SkillRepo => ({
  owner: "owner-a",
  name: "repo-a",
  branch: "main",
  enabled: true,
  ...overrides,
});

function renderPage(
  overrides: Partial<React.ComponentProps<typeof SkillsPage>> = {},
) {
  const installTo = vi.fn(
    async (install: (first: AppId) => Promise<Array<{ id: string }>>) => ({
      installed: await install("codex"),
      failures: [],
    }),
  );
  const onShowInstalled = vi.fn();
  const onUninstall = vi.fn();
  render(
    <SkillsPage
      visibleAppIds={["claude", "codex", "pi"]}
      installTargets={["codex", "claude"]}
      onInstallTargetsChange={vi.fn()}
      installTo={installTo as never}
      onShowInstalled={onShowInstalled}
      onUninstall={onUninstall}
      onOpenRepoManager={vi.fn()}
      onEnableFailures={vi.fn()}
      {...overrides}
    />,
  );
  return { installTo, onShowInstalled, onUninstall };
}

describe("SkillsPage (Discover)", () => {
  beforeEach(() => {
    viewportWidth = 500;
    rowHeights = {};
    resizeObservers.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        private entry: {
          callback: ResizeObserverCallback;
          targets: Set<Element>;
          observer: ResizeObserver;
        };
        constructor(callback: ResizeObserverCallback) {
          this.entry = {
            callback,
            targets: new Set(),
            observer: this as unknown as ResizeObserver,
          };
          resizeObservers.add(this.entry);
        }
        observe(target: Element) {
          this.entry.targets.add(target);
        }
        unobserve(target: Element) {
          this.entry.targets.delete(target);
        }
        disconnect() {
          resizeObservers.delete(this.entry);
        }
      },
    );
    for (const property of ["clientWidth", "offsetWidth"] as const) {
      vi.spyOn(HTMLElement.prototype, property, "get").mockImplementation(
        function (this: HTMLElement) {
          return this.dataset.testid === "skills-discover-scroll"
            ? viewportWidth
            : 0;
        },
      );
    }
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        if (this.dataset.testid === "skills-discover-scroll")
          return viewportWidth === 0 ? 0 : 600;
        if (viewportWidth === 0) return 0;
        return this.hasAttribute("data-index")
          ? (rowHeights[Number(this.dataset.index)] ?? 212)
          : 0;
      },
    );
    HTMLElement.prototype.scrollTo ??= vi.fn();
    m.install.mockReset().mockImplementation(async ({ skill }) => ({
      id: skill.key,
    }));
    m.addRepo.mockReset().mockResolvedValue(true);
    m.refetchDiscoverable.mockReset();
    m.discoverable = [];
    m.failures = [];
    m.installed = [];
    m.repos = [];
    searchCache.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("groups responsive cards into virtual rows and remeasures taller content without overlap", async () => {
    viewportWidth = 1100;
    rowHeights = { 0: 260 };
    m.repos = [makeRepo()];
    m.discoverable = Array.from({ length: 7 }, (_, index) =>
      makeDiscoverable({
        key: `skill-${index}`,
        name: `Skill ${index}`,
        directory: `skill-${index}`,
      }),
    );
    renderPage();
    const list = screen.getByRole("list", {
      name: "skillsPage.discover.listLabel",
    });
    const virtualRows = () =>
      Array.from(list.querySelectorAll<HTMLElement>("[data-index]"));
    await waitFor(() => expect(virtualRows()).toHaveLength(3));
    expect(
      virtualRows().map((row) => within(row).getAllByRole("listitem").length),
    ).toEqual([3, 3, 1]);
    expect(virtualRows()[1]).toHaveStyle({ transform: "translateY(276px)" });
    act(() => {
      rowHeights[0] = 340;
      notifyResize(virtualRows()[0]);
    });
    await waitFor(() =>
      expect(virtualRows()[1]).toHaveStyle({ transform: "translateY(356px)" }),
    );
    const scroll = screen.getByTestId("skills-discover-scroll");
    act(() => {
      viewportWidth = 700;
      notifyResize(scroll);
    });
    await waitFor(() => expect(virtualRows()).toHaveLength(4));
    expect(
      virtualRows().map((row) => within(row).getAllByRole("listitem").length),
    ).toEqual([2, 2, 2, 1]);
    act(() => {
      viewportWidth = 400;
      notifyResize(scroll);
    });
    await waitFor(() =>
      expect(
        virtualRows().every(
          (row) => within(row).getAllByRole("listitem").length === 1,
        ),
      ).toBe(true),
    );
    fireEvent.scroll(scroll, { target: { scrollTop: 1000 } });
    await waitFor(() =>
      expect(within(list).getByText("Skill 6")).toBeInTheDocument(),
    );
    expect(
      new Set(
        within(list)
          .getAllByRole("listitem")
          .map((card) => card.getAttribute("aria-posinset")),
      ).size,
    ).toBe(within(list).getAllByRole("listitem").length);
  });

  it("renders only visible card rows from a large catalog and preserves them while hidden", async () => {
    viewportWidth = 1100;
    m.repos = [makeRepo()];
    m.discoverable = Array.from({ length: 100 }, (_, index) =>
      makeDiscoverable({
        key: `skill-${index}`,
        name: `Skill ${index}`,
        directory: `skill-${index}`,
      }),
    );
    renderPage();
    await screen.findByText("Skill 0");
    const before = screen.getAllByRole("listitem").length;
    expect(before).toBeLessThan(30);
    act(() => {
      viewportWidth = 0;
      notifyResize(screen.getByTestId("skills-discover-scroll"));
      for (const row of document.querySelectorAll("[data-index]"))
        notifyResize(row);
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(before);
  });

  it("opens the selected card documentation directly", async () => {
    m.repos = [makeRepo()];
    m.discoverable = [
      makeDiscoverable({ readmeUrl: "https://example.com/skill-docs" }),
    ];
    const openExternal = vi
      .spyOn(settingsApi, "openExternal")
      .mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "skills.view" }),
    );
    expect(openExternal).toHaveBeenCalledWith("https://example.com/skill-docs");
    expect(m.install).not.toHaveBeenCalled();
  });

  it("installs the chosen skills.sh result into the first install-to app", async () => {
    setSearchResult("agent", 0, {
      skills: [
        makeSkillsSh({ key: "a", name: "Agent Browser A" }),
        makeSkillsSh({
          key: "b",
          name: "Agent Browser B",
          repoOwner: "owner-b",
          repoName: "repo-b",
        }),
      ],
      totalCount: 2,
      query: "agent",
    });
    const { installTo } = renderPage();
    // 没配置仓库时直接是 skills.sh
    const input = screen.getByRole("textbox", {
      name: "skillsPage.discover.skillsShAria",
    });
    await userEvent.type(input, "agent{Enter}");
    await screen.findByText("Agent Browser B");

    const rows = screen.getAllByRole("listitem");
    await userEvent.click(
      within(rows[1]).getByRole("button", {
        name: "skillsPage.discover.installAria",
      }),
    );
    await waitFor(() => expect(m.install).toHaveBeenCalledTimes(1));
    expect(installTo).toHaveBeenCalledTimes(1);
    const args = m.install.mock.calls[0][0];
    expect(args.currentApp).toBe("codex");
    expect(args.skill.repoOwner).toBe("owner-b");
    expect(args.skill.name).toBe("Agent Browser B");
  });

  it("keeps skills.sh results when the same query is submitted again", async () => {
    setSearchResult("figma", 0, {
      skills: [makeSkillsSh({ key: "f", name: "figma-use" })],
      totalCount: 1,
      query: "figma",
    });
    renderPage();
    const input = screen.getByRole("textbox", {
      name: "skillsPage.discover.skillsShAria",
    });
    await userEvent.type(input, "figma{Enter}");
    await screen.findByText("figma-use");
    await userEvent.type(input, "{Enter}");
    expect(screen.getByText("figma-use")).toBeInTheDocument();
  });

  it("refetches the first skills.sh page when retrying after a failure", async () => {
    const refetch = vi.fn();
    setSearchResult("boom", 0, undefined, { isError: true, refetch });
    renderPage();
    await userEvent.type(
      screen.getByRole("textbox", { name: "skillsPage.discover.skillsShAria" }),
      "boom{Enter}",
    );
    expect(screen.getByText("skills.skillssh.error")).toBeInTheDocument();
    // 第一页失败时 query key 没变，重试必须显式 refetch，不能只把 offset 设回 0
    await userEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows the loading state while a skills.sh query is fetching", async () => {
    setSearchResult("x1", 0, undefined, { isLoading: true, isFetching: true });
    renderPage();
    await userEvent.type(
      screen.getByRole("textbox", { name: "skillsPage.discover.skillsShAria" }),
      "x1{Enter}",
    );
    expect(screen.getByText("skills.skillssh.loading")).toBeInTheDocument();
  });

  it("stays on repositories when they return no skills, so a retry is possible", () => {
    m.repos = [makeRepo()];
    renderPage();
    expect(
      screen.getByRole("button", { name: "skillsPage.discover.sourceRepos" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText("skillsPage.discover.noneRead"),
    ).toBeInTheDocument();
  });

  it("says which repositories could not be read when only some failed", async () => {
    m.repos = [makeRepo(), makeRepo({ owner: "composio", name: "awesome" })];
    m.discoverable = [makeDiscoverable()];
    m.failures = [
      {
        owner: "composio",
        name: "awesome",
        branch: "main",
        error: JSON.stringify({
          code: "DOWNLOAD_FAILED",
          context: { status: "403" },
          suggestion: "http403",
        }),
      },
    ];
    renderPage();

    // 读到的照常列出，横幅说哪些没读到
    expect(screen.getByText("repo-skill")).toBeInTheDocument();
    expect(screen.getByText("skillsPage.repoFail.title")).toBeInTheDocument();
    expect(
      screen.getByText("skillsPage.repoFail.discoverBody"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(m.refetchDiscoverable).toHaveBeenCalled();

    // 仓库弹层里那一行写「读取失败」
    await userEvent.click(
      screen.getByRole("button", { name: /skillsPage.repos.buttonAll/ }),
    );
    expect(
      await screen.findByText("skillsPage.repos.readFailed"),
    ).toBeInTheDocument();
  });

  it("calls it a read failure, not an empty repository, when every repository failed", () => {
    m.repos = [makeRepo()];
    m.failures = [
      { owner: "owner-a", name: "repo-a", branch: "main", error: "timeout" },
    ];
    renderPage();
    expect(
      screen.getByText("skillsPage.discover.loadFailed"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("skillsPage.discover.noneRead"),
    ).not.toBeInTheDocument();
    // 全部没读到时由空状态说明，不再叠一条横幅
    expect(
      screen.queryByText("skillsPage.repoFail.discoverBody"),
    ).not.toBeInTheDocument();
  });

  it("keeps management navigation and direct uninstall on installed discovery cards", async () => {
    m.repos = [makeRepo()];
    m.discoverable = [
      makeDiscoverable(),
      makeDiscoverable({
        key: "other",
        name: "other-skill",
        directory: "other-skill",
      }),
    ];
    m.installed = [
      {
        id: "owner-a/repo-a:repo-skill",
        name: "repo-skill",
        directory: "repo-skill",
        repoOwner: "owner-a",
        repoName: "repo-a",
        apps: {
          claude: true,
          codex: true,
          gemini: false,
          opencode: false,
          openclaw: false,
          hermes: false,
          pi: false,
        },
        installedAt: 1,
        updatedAt: 1,
      },
    ];
    const { onShowInstalled, onUninstall } = renderPage();
    await userEvent.click(
      screen.getByRole("button", { name: "skillsPage.discover.installedAria" }),
    );
    expect(onShowInstalled).toHaveBeenCalledWith("owner-a/repo-a:repo-skill");
    await userEvent.click(
      screen.getByRole("button", { name: "skills.uninstall" }),
    );
    expect(onUninstall).toHaveBeenCalledWith("owner-a/repo-a:repo-skill");

    // 「只看未安装」是页内筛选：复选框，不是第二层分段控件
    expect(
      screen.queryByRole("button", { name: "skills.filter.uninstalled" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: "skillsPage.discover.onlyUninstalled",
      }),
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("other-skill")).toBeInTheDocument();
  });

  it("shows an install failure on the row and lets the user retry", async () => {
    m.repos = [makeRepo()];
    m.discoverable = [makeDiscoverable()];
    m.install.mockRejectedValueOnce(new Error("timeout"));
    renderPage();
    await userEvent.click(
      screen.getByRole("button", { name: "skillsPage.discover.installAria" }),
    );
    await waitFor(() =>
      expect(
        screen.getByText("skillsPage.discover.installFailed"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "skillsPage.discover.retryAria" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "skillsPage.discover.retryAria" }),
    );
    await waitFor(() => expect(m.install).toHaveBeenCalledTimes(2));
    expect(
      screen.queryByText("skillsPage.discover.installFailed"),
    ).not.toBeInTheDocument();
  });

  it("opens the existing skill when a discovered directory is already occupied", async () => {
    m.repos = [makeRepo()];
    m.discoverable = [makeDiscoverable()];
    m.installed = [
      {
        id: "local:repo-skill",
        name: "Local Skill",
        description: "",
        directory: "repo-skill",
        apps: {
          claude: true,
          codex: false,
          gemini: false,
          opencode: false,
          openclaw: false,
          hermes: false,
          pi: false,
        },
        installedAt: 1,
        updatedAt: 1,
      },
    ];
    const { onShowInstalled } = renderPage();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "skillsPage.discover.dirTaken",
      }),
    );
    expect(onShowInstalled).toHaveBeenCalledWith("local:repo-skill");
    expect(m.install).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "skillsPage.discover.installAria" }),
    ).not.toBeInTheDocument();
  });

  it("keeps partial target-enable failures after a successful card installation", async () => {
    m.repos = [makeRepo()];
    m.discoverable = [makeDiscoverable()];
    const failures = [
      {
        id: "repo-skill:owner-a:repo-a",
        app: "claude" as const,
        error: "permission denied",
      },
    ];
    const onEnableFailures = vi.fn();
    renderPage({
      installTo: async (install) => ({
        installed: await install("codex"),
        failures,
      }),
      onEnableFailures,
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: "skillsPage.discover.installAria",
      }),
    );
    await waitFor(() =>
      expect(onEnableFailures).toHaveBeenCalledWith(failures),
    );
    expect(m.install).toHaveBeenCalledTimes(1);
  });

  it("turns a repository off through add_skill_repo with enabled=false", async () => {
    m.repos = [makeRepo(), makeRepo({ owner: "b", name: "c" })];
    m.discoverable = [makeDiscoverable()];
    renderPage();
    await userEvent.click(
      screen.getByRole("button", { name: /skillsPage.repos.buttonAll/ }),
    );
    const boxes = await screen.findAllByRole("checkbox", {
      name: "skillsPage.repos.enableAria",
    });
    await userEvent.click(boxes[1]);
    await waitFor(() =>
      expect(m.addRepo).toHaveBeenCalledWith({
        owner: "b",
        name: "c",
        branch: "main",
        enabled: false,
      }),
    );
  });
});
