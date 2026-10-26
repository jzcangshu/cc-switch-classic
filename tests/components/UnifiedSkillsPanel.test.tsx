import { render, screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import i18n from "i18next";
import en from "@/i18n/locales/en.json";

import UnifiedSkillsPanel from "@/components/skills/UnifiedSkillsPanel";
import { settingsApi, skillsApi } from "@/lib/api";
import type {
  DiscoverableSkill,
  InstalledSkill,
  SkillBackupEntry,
  SkillRepoFailure,
  SkillUpdateInfo,
} from "@/lib/api/skills";

const m = vi.hoisted(() => ({
  scanUnmanaged: vi.fn(),
  toggle: vi.fn(),
  bulkToggle: vi.fn(),
  uninstall: vi.fn(),
  importSkills: vi.fn(),
  installFromZip: vi.fn(),
  deleteBackup: vi.fn(),
  restoreBackup: vi.fn(),
  checkUpdates: vi.fn(),
  updateSkill: vi.fn(),
  refetchBackups: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastInfo: vi.fn(),
  installed: [] as InstalledSkill[],
  discoverable: [] as DiscoverableSkill[],
  backups: [] as SkillBackupEntry[],
  updates: [] as SkillUpdateInfo[],
  repoFailures: [] as SkillRepoFailure[],
  checking: false,
  visibleApps: ["claude", "codex", "pi"] as string[],
}));

vi.mock("sonner", () => ({
  toast: {
    success: m.toastSuccess,
    error: m.toastError,
    warning: m.toastWarning,
    info: m.toastInfo,
  },
}));

vi.mock("@/components/mcp/useVisibleAppIds", () => ({
  useVisibleAppIds: (ids: string[]) =>
    ids.filter((id) => m.visibleApps.includes(id)),
}));

vi.mock("@/components/skills/SkillsStorageSheet", () => ({
  SkillsStorageSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="storage-sheet" /> : null,
}));

vi.mock("@/hooks/useSkills", () => ({
  useInstalledSkills: () => ({
    data: m.installed,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useSkillBackups: () => ({
    data: m.backups,
    refetch: m.refetchBackups,
    isFetching: false,
  }),
  useDeleteSkillBackup: () => ({
    mutateAsync: m.deleteBackup,
    isPending: false,
  }),
  useToggleSkillApp: () => ({ mutateAsync: m.toggle, isPending: false }),
  useBulkToggleSkillApp: () => ({
    mutateAsync: m.bulkToggle,
    isPending: false,
  }),
  useRestoreSkillBackup: () => ({
    mutateAsync: m.restoreBackup,
    isPending: false,
  }),
  useUninstallSkill: () => ({ mutateAsync: m.uninstall, isPending: false }),
  useScanUnmanagedSkills: () => ({
    data: [
      {
        directory: "shared-skill",
        name: "Shared Skill",
        foundIn: ["grokbuild", "claude"],
        path: "/tmp/shared-skill",
      },
    ],
    refetch: m.scanUnmanaged,
  }),
  useImportSkillsFromApps: () => ({
    mutateAsync: m.importSkills,
    isPending: false,
  }),
  useInstallSkillsFromZip: () => ({
    mutateAsync: m.installFromZip,
    isPending: false,
  }),
  useCheckSkillUpdates: () => ({
    data: { updates: m.updates, failures: m.repoFailures },
    refetch: m.checkUpdates,
    isFetching: m.checking,
    dataUpdatedAt: 0,
  }),
  useUpdateSkill: () => ({
    mutateAsync: m.updateSkill,
    isPending: false,
  }),
  useDiscoverableSkills: () => ({ data: m.discoverable, refetch: vi.fn() }),
  useDiscoverableSkillsFailures: () => ({ data: [] }),
  useSkillRepos: () => ({
    data: m.discoverable.length
      ? [{ owner: "owner", name: "repo", branch: "main", enabled: true }]
      : [],
    refetch: vi.fn(),
  }),
  useAddSkillRepo: () => ({ mutateAsync: vi.fn() }),
  useRemoveSkillRepo: () => ({ mutateAsync: vi.fn() }),
  useSearchSkillsSh: () => ({ data: undefined, isLoading: false }),
  useInstallSkill: () => ({ mutateAsync: vi.fn() }),
}));

type Overrides = Omit<Partial<InstalledSkill>, "apps"> & {
  apps?: Partial<InstalledSkill["apps"]>;
};

const makeSkill = (overrides: Overrides = {}): InstalledSkill => {
  const { apps, ...rest } = overrides;
  return {
    id: "owner/repo:alpha-skill",
    name: "Alpha Skill",
    description: "Alpha description",
    directory: "alpha-skill",
    repoOwner: "owner",
    repoName: "repo",
    repoBranch: "main",
    apps: {
      claude: false,
      codex: false,
      gemini: false,
      grokbuild: false,
      opencode: false,
      openclaw: false,
      hermes: false,
      pi: false,
      ...apps,
    },
    installedAt: 1,
    updatedAt: 1,
    ...rest,
  };
};

const renderPanel = (
  props: React.ComponentProps<typeof UnifiedSkillsPanel> = {},
) => render(<UnifiedSkillsPanel {...props} />);

const columns = () =>
  screen.getAllByRole("button", { name: /appMatrix.columnAria/ });

describe("UnifiedSkillsPanel", () => {
  beforeEach(() => {
    m.installed = [];
    m.discoverable = [];
    m.backups = [];
    m.updates = [];
    m.repoFailures = [];
    m.checking = false;
    m.visibleApps = ["claude", "codex", "pi"];
    m.scanUnmanaged.mockReset().mockResolvedValue({
      data: [
        {
          directory: "shared-skill",
          name: "Shared Skill",
          foundIn: ["grokbuild", "claude"],
          path: "/tmp/shared-skill",
        },
      ],
    });
    m.toggle.mockReset().mockResolvedValue(true);
    m.bulkToggle
      .mockReset()
      .mockImplementation(async ({ ids }) => ({ succeeded: ids, failed: [] }));
    m.uninstall.mockReset().mockResolvedValue({});
    m.importSkills.mockReset().mockResolvedValue([]);
    m.deleteBackup.mockReset();
    m.restoreBackup.mockReset();
    m.refetchBackups.mockReset().mockResolvedValue({ data: [] });
    m.checkUpdates
      .mockReset()
      .mockResolvedValue({ data: { updates: [], failures: [] } });
    m.installFromZip.mockReset();
    m.updateSkill
      .mockReset()
      .mockImplementation(async (id: string) => makeSkill({ id }));
    for (const fn of [
      m.toastError,
      m.toastSuccess,
      m.toastWarning,
      m.toastInfo,
    ]) {
      fn.mockReset();
    }
  });

  it("always shows the Pi column and toggles it like the other apps", async () => {
    m.installed = [makeSkill({ apps: { claude: true, pi: true } })];
    renderPanel();
    expect(columns()).toHaveLength(3);
    // Pi 列头的说明走 HoverTip（悬停即显），不再用原生 title
    expect(columns()[2]).not.toHaveAttribute("title");
    await userEvent.hover(columns()[2]);
    expect(
      (await screen.findAllByText("skillsPage.piColumnTitle")).length,
    ).toBeGreaterThan(0);
    await userEvent.unhover(columns()[2]);

    const cells = screen.getAllByRole("button", { name: /appMatrix.cell/ });
    expect(cells[2]).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(cells[2]);
    await waitFor(() =>
      expect(m.toggle).toHaveBeenCalledWith({
        id: "owner/repo:alpha-skill",
        app: "pi",
        enabled: false,
      }),
    );
  });

  it("hides the Pi column only when Pi is hidden on the Apps page", () => {
    m.visibleApps = ["claude", "codex"];
    m.installed = [makeSkill()];
    renderPanel();
    expect(columns()).toHaveLength(2);
  });

  it("distinguishes an empty list from a search miss", async () => {
    renderPanel();
    expect(screen.getByText("skillsPage.emptyTitle")).toBeInTheDocument();
  });

  it("shows a search miss with a way into Discover", async () => {
    m.installed = [makeSkill()];
    renderPanel();
    await userEvent.type(
      screen.getByRole("textbox", { name: "skills.installedSearchAriaLabel" }),
      "zzz",
    );
    expect(screen.getByText("skillsPage.noMatch")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "skillsPage.searchInDiscover" }),
    ).toBeInTheDocument();
  });

  it("bulk-enables only the disabled Skills in a column and offers undo", async () => {
    m.installed = [
      makeSkill({ id: "a", name: "A", apps: { codex: true } }),
      makeSkill({ id: "b", name: "B" }),
      makeSkill({ id: "c", name: "C" }),
    ];
    renderPanel();
    await userEvent.click(columns()[1]);
    await userEvent.click(
      screen.getByRole("button", { name: "appMatrix.pop.enableRest" }),
    );
    await waitFor(() =>
      expect(m.bulkToggle).toHaveBeenCalledWith({
        ids: ["b", "c"],
        app: "codex",
        enabled: true,
      }),
    );
    await waitFor(() => expect(m.toastSuccess).toHaveBeenCalled());
    const [, options] = m.toastSuccess.mock.calls[0];
    act(() => options.action.onClick());
    await waitFor(() =>
      expect(m.bulkToggle).toHaveBeenLastCalledWith({
        ids: ["b", "c"],
        app: "codex",
        enabled: false,
      }),
    );
  });

  it.each([true, false])(
    "shows an error toast when every bulk toggle fails (enabled=%s)",
    async (enabled) => {
      m.visibleApps = ["hermes"];
      m.installed = [
        makeSkill({ id: "a", name: "A", apps: { hermes: !enabled } }),
        makeSkill({ id: "b", name: "B", apps: { hermes: !enabled } }),
      ];
      m.bulkToggle.mockResolvedValueOnce({
        succeeded: [],
        failed: ["a", "b"].map((item) => ({
          item,
          error: new Error("Invalid skill directory"),
        })),
      });
      renderPanel();
      await userEvent.click(columns()[0]);
      await userEvent.click(
        screen.getByRole("button", {
          name: enabled
            ? "appMatrix.pop.enableRest"
            : "appMatrix.pop.disableAll",
        }),
      );
      await waitFor(() =>
        expect(m.toastError).toHaveBeenCalledWith(
          expect.stringContaining("appMatrix.toast.partialFail"),
          { closeButton: true },
        ),
      );
      expect(m.bulkToggle).toHaveBeenCalledWith({
        ids: ["a", "b"],
        app: "hermes",
        enabled,
      });
      expect(
        screen.getAllByRole("button", { name: "appMatrix.cell.fail" }),
      ).toHaveLength(2);
      expect(m.toastSuccess).not.toHaveBeenCalled();
      expect(m.toastWarning).not.toHaveBeenCalled();
    },
  );

  it("keeps the count bar's direct bulk action on every Skill during search", async () => {
    m.installed = [
      makeSkill({ id: "a", name: "Alpha" }),
      makeSkill({ id: "b", name: "Beta", apps: { codex: true } }),
      makeSkill({ id: "c", name: "Charlie" }),
    ];
    renderPanel();
    await userEvent.type(
      screen.getByRole("textbox", {
        name: "skills.installedSearchAriaLabel",
      }),
      "Alpha",
    );
    await userEvent.click(
      screen.getAllByRole("checkbox", {
        name: "common.enableAllForApp",
      })[1],
    );
    await waitFor(() =>
      expect(m.bulkToggle).toHaveBeenCalledWith({
        ids: ["a", "c"],
        app: "codex",
        enabled: true,
      }),
    );
    const [, options] = m.toastSuccess.mock.calls[0];
    act(() => options.action.onClick());
    await waitFor(() =>
      expect(m.bulkToggle).toHaveBeenLastCalledWith({
        ids: ["a", "c"],
        app: "codex",
        enabled: false,
      }),
    );
  });

  it("keeps the scoped batch action inside the current search", async () => {
    m.installed = [
      makeSkill({ id: "a", name: "Alpha" }),
      makeSkill({
        id: "b",
        name: "Beta",
        description: "Beta description",
        directory: "beta-skill",
      }),
    ];
    renderPanel();
    await userEvent.type(
      screen.getByRole("textbox", {
        name: "skills.installedSearchAriaLabel",
      }),
      "Alpha",
    );
    await userEvent.click(columns()[1]);
    expect(screen.getByText("appMatrix.pop.scopeSearch")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: "appMatrix.pop.enableRest",
      }),
    );
    await waitFor(() =>
      expect(m.bulkToggle).toHaveBeenCalledWith({
        ids: ["a"],
        app: "codex",
        enabled: true,
      }),
    );
  });

  it("marks partial bulk failures in the matrix", async () => {
    m.installed = [
      makeSkill({ id: "a", name: "A" }),
      makeSkill({ id: "b", name: "B" }),
    ];
    m.bulkToggle.mockResolvedValueOnce({
      succeeded: ["a"],
      failed: [{ item: "b", error: new Error("symlink failed") }],
    });
    renderPanel();
    await userEvent.click(columns()[0]);
    await userEvent.click(
      screen.getByRole("button", { name: "appMatrix.pop.enableRest" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "appMatrix.cell.fail" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/skillsPage.rowFail/)).toBeInTheDocument();
    expect(m.toastWarning).toHaveBeenCalledWith(
      expect.stringContaining("appMatrix.toast.partialFail"),
      expect.objectContaining({
        closeButton: true,
        duration: 8000,
        action: expect.anything(),
      }),
    );
    expect(m.toastSuccess).not.toHaveBeenCalled();
    expect(m.toastError).not.toHaveBeenCalled();
    const [, options] = m.toastWarning.mock.calls[0];
    act(() => options.action.onClick());
    await waitFor(() =>
      expect(m.bulkToggle).toHaveBeenLastCalledWith({
        ids: ["a"],
        app: "claude",
        enabled: false,
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "skillsPage.fixSync" }),
    );
    expect(screen.getByTestId("storage-sheet")).toBeInTheDocument();
  });

  describe.each([true, false])("bulk undo feedback (enabled=%s)", (enabled) => {
    beforeEach(() => {
      m.visibleApps = ["hermes"];
      m.installed = ["a", "b"].map((id) =>
        makeSkill({ id, name: id, apps: { hermes: !enabled } }),
      );
      // Check the actual outcome text and count without changing panel labels.
      i18n.addResourceBundle("zh", "translation", {
        common: { bulkToggleFailed: en.common.bulkToggleFailed },
        appMatrix: { toast: { undone: en.appMatrix.toast.undone } },
      });
    });

    afterEach(() => {
      i18n.removeResourceBundle("zh", "translation");
    });

    it.each(["success", "partial", "total", "rejected"] as const)(
      "reports %s undo results and preserves failed-cell retries",
      async (outcome) => {
        renderPanel();
        await userEvent.click(columns()[0]);
        await userEvent.click(
          screen.getByRole("button", {
            name: enabled
              ? "appMatrix.pop.enableRest"
              : "appMatrix.pop.disableAll",
          }),
        );
        await waitFor(() => expect(m.toastSuccess).toHaveBeenCalledTimes(1));
        const [, options] = m.toastSuccess.mock.calls[0];
        m.toastSuccess.mockClear();

        const failedIds =
          outcome === "success"
            ? []
            : outcome === "partial"
              ? ["b"]
              : ["a", "b"];
        if (outcome === "rejected") {
          m.bulkToggle.mockRejectedValueOnce(new Error("undo failed"));
        } else {
          m.bulkToggle.mockResolvedValueOnce({
            succeeded: ["a", "b"].filter((id) => !failedIds.includes(id)),
            failed: failedIds.map((item) => ({
              item,
              error: new Error("undo failed"),
            })),
          });
        }
        act(() => options.action.onClick());

        const expectedToast =
          outcome === "success"
            ? m.toastSuccess
            : outcome === "partial"
              ? m.toastWarning
              : m.toastError;
        await waitFor(() =>
          expect(expectedToast).toHaveBeenCalledWith(
            outcome === "success"
              ? "Undone"
              : `Failed to update ${failedIds.length} item(s)`,
            { closeButton: true },
          ),
        );
        for (const other of [m.toastSuccess, m.toastWarning, m.toastError]) {
          if (other !== expectedToast) expect(other).not.toHaveBeenCalled();
        }
        expect(m.bulkToggle).toHaveBeenLastCalledWith({
          ids: ["a", "b"],
          app: "hermes",
          enabled: !enabled,
        });
        const failedCells = screen.queryAllByRole("button", {
          name: "appMatrix.cell.fail",
        });
        expect(failedCells).toHaveLength(failedIds.length);

        if (failedIds.length > 0) {
          // Undo releases the write lock and retry keeps the inverse target.
          await userEvent.click(failedCells[0]);
          await waitFor(() =>
            expect(m.toggle).toHaveBeenCalledWith({
              id: failedIds[0],
              app: "hermes",
              enabled: !enabled,
            }),
          );
          await waitFor(() =>
            expect(
              screen.queryAllByRole("button", { name: "appMatrix.cell.fail" }),
            ).toHaveLength(failedIds.length - 1),
          );
        }
      },
    );
  });

  it("enables the selected Skills in one app from the selection bar", async () => {
    m.installed = [
      makeSkill({ id: "a", name: "A" }),
      makeSkill({ id: "b", name: "B" }),
      makeSkill({ id: "c", name: "C" }),
    ];
    renderPanel();
    const picks = screen.getAllByRole("checkbox", {
      name: "skillsPage.selectAria",
    });
    await userEvent.click(picks[0]);
    await userEvent.click(picks[2]);
    expect(screen.getByText("skillsPage.bulk.selected")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /skillsPage.bulk.enableTo/ }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: /Codex/ }),
    );
    await waitFor(() =>
      expect(m.bulkToggle).toHaveBeenCalledWith({
        ids: ["a", "c"],
        app: "codex",
        enabled: true,
      }),
    );
  });

  it("selects every listed Skill from the header checkbox", async () => {
    m.installed = [
      makeSkill({ id: "a", name: "A" }),
      makeSkill({ id: "b", name: "B" }),
    ];
    renderPanel();
    const all = screen.getByRole("checkbox", {
      name: "skillsPage.selectAllAria",
    }) as HTMLInputElement;
    const picks = screen.getAllByRole("checkbox", {
      name: "skillsPage.selectAria",
    });

    await userEvent.click(picks[0]);
    expect(all.indeterminate).toBe(true);

    await userEvent.click(all);
    expect(all.checked).toBe(true);
    for (const pick of picks) expect(pick).toBeChecked();

    await userEvent.click(all);
    expect(all.checked).toBe(false);
    for (const pick of picks) expect(pick).not.toBeChecked();
  });

  it("uninstalls directly from the card after confirming", async () => {
    m.installed = [makeSkill()];
    m.uninstall.mockResolvedValueOnce({
      preservedPiPath: "/tmp/.pi/agent/skills/alpha-skill",
    });
    renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "skillsPage.uninstallEllipsis" }),
    );
    expect(
      screen.getByText("skillsPage.confirm.uninstallBody"),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "skills.uninstall" }),
    );
    await waitFor(() =>
      expect(m.uninstall).toHaveBeenCalledWith("owner/repo:alpha-skill"),
    );
    await waitFor(() =>
      expect(m.toastWarning).toHaveBeenCalledWith(
        "skills.uninstallSuccess",
        expect.objectContaining({ description: "skills.uninstallPiPreserved" }),
      ),
    );
  });

  it("uses the existing confirmation and write lock when uninstalling from discovery", async () => {
    m.installed = [makeSkill()];
    m.discoverable = [
      {
        key: "alpha",
        name: "Alpha Skill",
        directory: "alpha-skill",
        description: "Alpha description",
        repoOwner: "owner",
        repoName: "repo",
        repoBranch: "main",
      },
    ];
    const width = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(500);
    const height = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(600);
    HTMLElement.prototype.scrollTo ??= vi.fn();
    let finish!: () => void;
    m.uninstall.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({});
        }),
    );
    renderPanel({ initialView: "discover" });
    await userEvent.click(
      await screen.findByRole("button", { name: "skills.uninstall" }),
    );
    expect(m.uninstall).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("skillsPage.confirm.uninstallBody"),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "skills.uninstall" }),
    );
    await waitFor(() => expect(m.uninstall).toHaveBeenCalledTimes(1));
    expect(
      within(dialog).getByRole("button", { name: "skills.uninstall" }),
    ).toBeDisabled();
    await act(async () => finish());
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    width.mockRestore();
    height.mockRestore();
  });

  it("filters to Skills with updates from the header count and updates them after confirming", async () => {
    m.installed = [
      makeSkill({ id: "a", name: "A" }),
      makeSkill({ id: "b", name: "B" }),
    ];
    m.updates = [
      { id: "b", name: "B", remoteHash: "x" },
      { id: "gone", name: "Gone", remoteHash: "y" },
    ];
    renderPanel();
    // 更新横幅已去掉：页头的「N 个可更新」、行上的徽标、「检查更新」按钮说的是同一件事
    expect(screen.getAllByText("skills.updateAvailable")).toHaveLength(1);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    // 全部更新和重新检查都是直接入口，不用先筛选或展开菜单。
    expect(
      screen.getAllByRole("button", { name: "skillsPage.updateAllCount" }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "skills.checkUpdates" }),
    ).toBeInTheDocument();

    const chip = screen.getByRole("button", {
      name: "skillsPage.headerUpdates",
    });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);

    // 再点一次恢复全部
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    await userEvent.click(chip);
    await userEvent.click(
      screen.getByRole("button", { name: "skillsPage.updateAllCount" }),
    );
    // 确认框列出要更新哪些；已经不在本机的「Gone」不列
    const list = screen.getByRole("list", {
      name: "skillsPage.confirm.updateListAria",
    });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("B")).toBeInTheDocument();
    // 仓库名可点，打开的地址和列表行的来源链接一致
    const openExternal = vi
      .spyOn(settingsApi, "openExternal")
      .mockResolvedValue(undefined);
    await userEvent.click(
      within(rows[0]).getByRole("button", { name: "owner/repo" }),
    );
    expect(openExternal).toHaveBeenCalledWith("https://github.com/owner/repo");
    openExternal.mockRestore();
    expect(within(list).queryByText("Gone")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: "skillsPage.confirm.updateAllButton",
      }),
    );
    await waitFor(() => expect(m.updateSkill).toHaveBeenCalledTimes(1));
    expect(m.updateSkill).toHaveBeenCalledWith("b");
  });

  it("opens discovery directly, returns to installed, and keeps the discovery state mounted", async () => {
    m.installed = [makeSkill()];
    renderPanel();
    expect(
      screen.queryByRole("tablist", { name: "skillsPage.viewAria" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "skills.discover" }),
    );
    const search = screen.getByRole("textbox", {
      name: "skillsPage.discover.skillsShAria",
    });
    await userEvent.type(search, "remembered-query");
    await userEvent.click(screen.getByRole("button", { name: "common.back" }));
    expect(search).not.toBeVisible();
    expect(screen.getByTestId("skills-matrix")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "skills.discover" }),
    );
    expect(
      screen.getByRole("textbox", { name: "skillsPage.discover.skillsShAria" }),
    ).toBe(search);
    expect(search).toHaveValue("remembered-query");
  });

  it("keeps the direct discovery action locked while an installed skill is being written", async () => {
    m.installed = [makeSkill()];
    let finish!: () => void;
    m.toggle.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({});
        }),
    );
    renderPanel();
    await userEvent.click(
      screen.getAllByRole("button", { name: /appMatrix.cell/ })[0],
    );
    const discover = screen.getByRole("button", { name: "skills.discover" });
    expect(discover).toBeDisabled();
    await userEvent.click(discover);
    expect(screen.getByTestId("skills-matrix")).toBeVisible();
    await act(async () => finish());
    expect(discover).toBeEnabled();
    await userEvent.click(discover);
    expect(
      screen.getByRole("heading", { name: "skills.discover" }),
    ).toBeVisible();
  });

  it("keeps check, restore, ZIP and import directly available and storage settings reachable", async () => {
    m.installed = [makeSkill()];
    renderPanel();
    for (const name of [
      "skills.checkUpdates",
      "skillsPage.moreMenu.restore",
      "skillsPage.addMenu.zip",
      /^skillsPage\.addMenu\.import/,
    ]) {
      expect(screen.getByRole("button", { name })).toBeEnabled();
    }
    await userEvent.click(
      screen.getByRole("button", { name: "skills.moreActions" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "skills.storageSheet.open" }),
    );
    expect(screen.getByTestId("storage-sheet")).toBeInTheDocument();
  });

  it("opens documentation and updates from installed card buttons", async () => {
    m.installed = [makeSkill({ readmeUrl: "https://example.com/alpha" })];
    m.updates = [
      { id: "owner/repo:alpha-skill", name: "Alpha Skill", remoteHash: "new" },
    ];
    const openExternal = vi
      .spyOn(settingsApi, "openExternal")
      .mockResolvedValue(undefined);
    renderPanel();
    const card = screen.getByRole("listitem");
    await userEvent.click(
      within(card).getByRole("button", { name: "mcpPage.openDocs" }),
    );
    expect(openExternal).toHaveBeenCalledWith("https://example.com/alpha");
    await userEvent.click(
      within(card).getByRole("button", { name: "skills.update" }),
    );
    await waitFor(() =>
      expect(m.updateSkill).toHaveBeenCalledWith("owner/repo:alpha-skill"),
    );
    openExternal.mockRestore();
  });

  it("lets the unmanaged notice be ignored with one control", async () => {
    m.installed = [makeSkill()];
    renderPanel();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "skillsPage.banner.ignore" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: "skillsPage.banner.close" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "skillsPage.banner.ignore" }),
    );
    expect(
      screen.queryByText("skillsPage.banner.unmanaged"),
    ).not.toBeInTheDocument();
  });

  it("highlights a column header and shows the app name while hovering its cells", async () => {
    m.installed = [makeSkill({ apps: { claude: true } })];
    renderPanel();
    const cells = screen.getAllByRole("button", { name: /appMatrix.cell/ });
    // 开 / 关是同一个方框，只换填充
    expect(cells[0]).toHaveAttribute("data-state", "on");
    expect(cells[1]).toHaveAttribute("data-state", "off");
    expect(cells[0].className).toBe(cells[1].className);

    expect(screen.queryByTestId("matrix-column-name")).not.toBeInTheDocument();
    await userEvent.hover(cells[1]);
    expect(columns()[1]).toHaveAttribute("data-highlighted");
    expect(columns()[0]).not.toHaveAttribute("data-highlighted");
    expect(screen.getByTestId("matrix-column-name")).toHaveTextContent("Codex");
    await userEvent.unhover(cells[1]);
    expect(columns()[1]).not.toHaveAttribute("data-highlighted");
    expect(screen.queryByTestId("matrix-column-name")).not.toBeInTheDocument();

    await userEvent.hover(columns()[2]);
    expect(screen.getByTestId("matrix-column-name")).toHaveTextContent("Pi");
  });

  it("ignores a second check-update click while one is running", async () => {
    m.installed = [makeSkill()];
    let resolve!: (value: {
      data: { updates: never[]; failures: never[] };
    }) => void;
    m.checkUpdates.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    renderPanel();
    const button = screen.getByRole("button", { name: "skills.checkUpdates" });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(m.checkUpdates).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({ data: { updates: [], failures: [] } });
    });
  });

  it("closes the confirm dialog right away and shows progress while updating", async () => {
    m.installed = [
      makeSkill({ id: "a", name: "A" }),
      makeSkill({ id: "b", name: "B" }),
    ];
    m.updates = [
      { id: "a", name: "A", remoteHash: "x" },
      { id: "b", name: "B", remoteHash: "y" },
    ];
    const pending: Array<(value: InstalledSkill) => void> = [];
    m.updateSkill.mockImplementation(
      (id: string) =>
        new Promise<InstalledSkill>((resolve) => {
          pending.push(() => resolve(makeSkill({ id, name: id })));
        }),
    );
    renderPanel();

    await userEvent.click(
      screen.getByRole("button", { name: "skillsPage.updateAllCount" }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "skillsPage.confirm.updateAllButton",
      }),
    );
    // 第一个还没更新完，确认框已经关了，进度在按钮上
    await waitFor(() => expect(m.updateSkill).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole("button", {
        name: "skillsPage.confirm.updateAllButton",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "skillsPage.updatingProgress" }),
    ).toBeDisabled();

    await act(async () => pending[0]?.(makeSkill()));
    await waitFor(() => expect(m.updateSkill).toHaveBeenCalledTimes(2));
    await act(async () => pending[1]?.(makeSkill()));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "skillsPage.updatingProgress" }),
      ).not.toBeInTheDocument(),
    );
    expect(m.toastSuccess).toHaveBeenCalledWith(
      "skills.updateAllSuccess",
      expect.anything(),
    );
  });

  it("asks to update everything right after a check finds updates", async () => {
    m.installed = [makeSkill({ id: "a", name: "A" })];
    const updates = [
      { id: "a", name: "A", remoteHash: "x" },
      { id: "gone", name: "Gone", remoteHash: "y" },
    ];
    m.checkUpdates.mockImplementationOnce(async () => {
      // 真实的 refetch 会把结果写进查询缓存
      m.updates = updates;
      return { data: { updates, failures: [] } };
    });
    renderPanel();

    await userEvent.click(
      screen.getByRole("button", { name: "skills.checkUpdates" }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "skillsPage.confirm.updateAllButton",
      }),
    );
    await waitFor(() => expect(m.updateSkill).toHaveBeenCalledTimes(1));
    expect(m.updateSkill).toHaveBeenCalledWith("a");
  });

  it("does not call everything up to date when a repository could not be read", async () => {
    m.installed = [makeSkill()];
    const failure = {
      owner: "owner",
      name: "repo",
      branch: "main",
      error: "network down",
    };
    m.checkUpdates.mockResolvedValueOnce({
      data: { updates: [], failures: [failure] },
    });
    renderPanel();

    await userEvent.click(
      screen.getByRole("button", { name: "skills.checkUpdates" }),
    );

    await waitFor(() =>
      expect(m.toastWarning).toHaveBeenCalledWith(
        "skills.updatesIncomplete",
        expect.anything(),
      ),
    );
    expect(m.toastSuccess).not.toHaveBeenCalledWith(
      "skills.noUpdates",
      expect.anything(),
    );
  });

  it("shows which repositories the update check could not read", () => {
    m.installed = [makeSkill()];
    m.repoFailures = [
      { owner: "owner", name: "repo", branch: "main", error: "network down" },
    ];
    renderPanel();
    expect(screen.getByText("skillsPage.repoFail.title")).toBeInTheDocument();
    expect(
      screen.getByText("skillsPage.repoFail.updatesBody"),
    ).toBeInTheDocument();
  });

  it("says which ZIP Skills were skipped because the folder name is taken", async () => {
    m.installed = [makeSkill()];
    const dialog = vi
      .spyOn(skillsApi, "openZipFileDialog")
      .mockResolvedValue("/tmp/team.zip");
    m.installFromZip.mockResolvedValueOnce({
      installed: [],
      skipped: [
        {
          directory: "my-helper",
          existingId: "local:my-helper",
          existingName: "My Helper",
        },
      ],
    });
    renderPanel();

    await userEvent.click(
      screen.getByRole("button", { name: "skillsPage.addMenu.zip" }),
    );

    await waitFor(() =>
      expect(m.toastWarning).toHaveBeenCalledWith(
        "skills.installFromZip.allSkipped",
        expect.objectContaining({
          description: "skills.installFromZip.skippedBody",
        }),
      ),
    );
    expect(m.toastInfo).not.toHaveBeenCalledWith(
      "skills.installFromZip.noSkillsFound",
      expect.anything(),
    );
    dialog.mockRestore();
  });

  it("blocks actions but not navigation while checking updates", async () => {
    m.installed = [makeSkill()];
    m.checking = true;
    const onInteraction = vi.fn();
    const onNavigation = vi.fn();
    renderPanel({
      onInteractionBlockedChange: onInteraction,
      onNavigationBlockedChange: onNavigation,
    });
    await waitFor(() => {
      expect(onInteraction).toHaveBeenLastCalledWith(true);
      expect(onNavigation).toHaveBeenLastCalledWith(false);
    });
    // 外观上的禁用晚 300ms 出现（useDelayedFlag），拦截本身是立即的
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /appMatrix.cell/ })[0],
      ).toBeDisabled(),
    );
  });

  it("imports with apps chosen from where each Skill was found", async () => {
    m.installed = [makeSkill()];
    m.visibleApps = ["claude", "codex", "grokbuild", "pi"];
    m.importSkills.mockResolvedValueOnce([makeSkill({ id: "shared" })]);
    renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "skillsPage.banner.reviewImport" }),
    );
    await waitFor(() =>
      expect(screen.getByText("skillsPage.import.title")).toBeInTheDocument(),
    );
    // Pi 按目录判断，导入时不提供勾选
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("Pi")).not.toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "skillsPage.import.submit" }),
    );
    await waitFor(() => expect(m.importSkills).toHaveBeenCalled());
    expect(m.importSkills.mock.calls[0][0]).toEqual([
      {
        directory: "shared-skill",
        apps: {
          claude: true,
          codex: false,
          gemini: false,
          grokbuild: true,
          opencode: false,
          openclaw: false,
          hermes: false,
          pi: false,
          mcode: false,
          kimi: false,
          agy: false,
        },
      },
    ]);
  });

  it("closes the backup dialog and reports an explicit refresh failure", async () => {
    m.refetchBackups.mockRejectedValueOnce(new Error("refresh failed"));
    renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "skillsPage.moreMenu.restore" }),
    );
    await waitFor(() =>
      expect(m.toastError).toHaveBeenCalledWith("common.error", {
        description: "Error: refresh failed",
      }),
    );
    expect(
      screen.queryByText("skills.restoreFromBackup.title"),
    ).not.toBeInTheDocument();
  });

  it("does not report a completed backup deletion as failed when refresh rejects", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    m.backups = [
      {
        backupId: "backup-1",
        backupPath: "/backups/backup-1",
        createdAt: 1,
        skill: makeSkill({ name: "Backup Skill" }),
      },
    ];
    m.deleteBackup.mockResolvedValueOnce(true);
    m.refetchBackups
      .mockResolvedValueOnce({ data: m.backups })
      .mockRejectedValueOnce(new Error("refresh failed"));
    renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "skillsPage.moreMenu.restore" }),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: "skills.restoreFromBackup.delete",
      }),
    );
    const confirmDialog = screen
      .getByText("skills.restoreFromBackup.deleteConfirmTitle")
      .closest<HTMLElement>('[role="dialog"]');
    await userEvent.click(
      within(confirmDialog!).getByRole("button", {
        name: "skills.restoreFromBackup.delete",
      }),
    );
    await waitFor(() =>
      expect(m.toastSuccess).toHaveBeenCalledWith(
        "skills.restoreFromBackup.deleteSuccess",
        { closeButton: true },
      ),
    );
    expect(m.toastError).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
