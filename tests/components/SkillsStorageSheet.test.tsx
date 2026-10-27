import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  SkillsStorageSheet,
  SkillsStorageSettings,
} from "@/components/skills/SkillsStorageSheet";
import type { SettingsFormState } from "@/hooks/useSettings";

const m = vi.hoisted(() => ({
  settings: {
    skillStorageLocation: "cc_switch",
    skillSyncMethod: "auto",
  } as Record<string, string | undefined>,
  installed: [] as { id: string }[],
  updateSettings: vi.fn(),
  autoSaveSettings: vi.fn(),
  resync: vi.fn(),
  migrate: vi.fn(),
  openDir: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: m.toastSuccess,
    warning: m.toastWarning,
    error: m.toastError,
  },
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: m.settings,
    updateSettings: m.updateSettings,
    autoSaveSettings: m.autoSaveSettings,
  }),
}));

vi.mock("@/hooks/useSkills", () => ({
  useInstalledSkills: () => ({ data: m.installed }),
  useCcSwitchSkillsDir: () => ({ data: "/Users/jason/.cc-switch/skills" }),
  useResyncSkillsToApps: () => ({ mutateAsync: m.resync, isPending: false }),
}));

vi.mock("@/lib/api/skills", () => ({
  skillsApi: {
    migrateStorage: m.migrate,
    openCcSwitchSkillsDir: m.openDir,
  },
}));

const renderDialog = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SkillsStorageSheet open onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );

const radio = (name: string | RegExp) => screen.getByRole("radio", { name });

const moveButton = () =>
  screen.getByRole("button", { name: /skills\.storageSheet\.move$/ });

describe("SkillsStorageSheet", () => {
  beforeEach(() => {
    m.settings = { skillStorageLocation: "cc_switch", skillSyncMethod: "auto" };
    m.installed = [];
    m.autoSaveSettings.mockResolvedValue(undefined);
  });

  it.each(["auto", "symlink", "copy"] as const)(
    "shows the backend sync method %s as the checked option",
    (method) => {
      m.settings = { ...m.settings, skillSyncMethod: method };
      renderDialog();

      const options = {
        auto: radio("skills.storageSheet.syncAuto"),
        symlink: radio(/skills\.storageSheet\.syncSymlink/),
        copy: radio(/skills\.storageSheet\.syncCopy/),
      };
      for (const [id, element] of Object.entries(options)) {
        if (id === method) expect(element).toBeChecked();
        else expect(element).not.toBeChecked();
      }
    },
  );

  it("treats a missing sync method as automatic, like the backend default", () => {
    m.settings = { skillStorageLocation: "cc_switch" };
    renderDialog();

    expect(radio("skills.storageSheet.syncAuto")).toBeChecked();
  });

  it("saves the picked sync method", async () => {
    renderDialog();

    await userEvent.click(radio(/skills\.storageSheet\.syncCopy/));

    expect(m.updateSettings).toHaveBeenCalledWith({ skillSyncMethod: "copy" });
    expect(m.autoSaveSettings).toHaveBeenCalledWith({
      skillSyncMethod: "copy",
    });
  });

  it("shows the real CC Switch folder and opens it", async () => {
    m.openDir.mockResolvedValue(undefined);
    renderDialog();

    expect(screen.getByText("~/.cc-switch/skills")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", {
        name: "skills.storageSheet.openFolderAria",
      }),
    );

    expect(m.openDir).toHaveBeenCalledTimes(1);
  });

  it("only shows the unified-directory warning after that location is picked", async () => {
    renderDialog();
    expect(
      screen.queryByText("skills.storageSheet.unifiedWarning"),
    ).not.toBeInTheDocument();

    await userEvent.click(radio(/skills\.storageSheet\.locationUnified/));
    expect(
      screen.getByText("skills.storageSheet.unifiedWarning"),
    ).toBeInTheDocument();

    await userEvent.click(radio("skills.storageSheet.locationCcSwitch"));
    expect(
      screen.queryByText("skills.storageSheet.unifiedWarning"),
    ).not.toBeInTheDocument();
  });

  it("keeps move-and-switch unavailable until another location is picked", async () => {
    m.installed = [{ id: "a" }, { id: "b" }];
    renderDialog();

    expect(radio("skills.storageSheet.locationCcSwitch")).toBeChecked();
    expect(moveButton()).toBeDisabled();
    // 原因是看得见的一行，按钮用 aria-describedby 指向它
    expect(moveButton()).toHaveAccessibleDescription(
      "skills.storageSheet.moveHint",
    );

    await userEvent.click(moveButton());
    expect(
      screen.queryByText("skills.storageSheet.moveConfirmTitle"),
    ).not.toBeInTheDocument();
    expect(m.migrate).not.toHaveBeenCalled();
  });

  it("confirms before moving Skills to the other location", async () => {
    m.installed = [{ id: "a" }, { id: "b" }];
    m.migrate.mockResolvedValue({
      migratedCount: 2,
      skippedCount: 0,
      errors: [],
    });
    renderDialog();

    await userEvent.click(radio(/skills\.storageSheet\.locationUnified/));
    expect(moveButton()).toBeEnabled();
    await userEvent.click(moveButton());

    expect(
      screen.getByText("skills.storageSheet.moveConfirmTitle"),
    ).toBeInTheDocument();
    expect(m.migrate).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", {
        name: "skills.storageSheet.moveConfirmButton",
      }),
    );

    await waitFor(() => expect(m.migrate).toHaveBeenCalledWith("unified"));
    await waitFor(() =>
      expect(m.updateSettings).toHaveBeenCalledWith({
        skillStorageLocation: "unified",
      }),
    );
    expect(m.toastSuccess).toHaveBeenCalledWith(
      "skills.storageSheet.moveDone",
      expect.anything(),
    );
  });

  it("resyncs Skills to every app on demand", async () => {
    m.resync.mockResolvedValue([
      { app: "claude", ok: true, failedSkills: [] },
      { app: "codex", ok: true, failedSkills: [] },
    ]);
    renderDialog();

    expect(
      screen.getByText("skills.storageSheet.resyncHint"),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "skills.storageSheet.resync" }),
    );

    await waitFor(() => expect(m.resync).toHaveBeenCalledTimes(1));
    expect(m.toastSuccess).toHaveBeenCalledWith(
      "skills.storageSheet.resyncDone",
      expect.anything(),
    );
  });

  it("uses the settings page's callbacks and keeps partial migration details inline", async () => {
    const onMigrated = vi.fn();
    const onChange = vi.fn().mockResolvedValue(true);
    m.migrate.mockResolvedValue({
      migratedCount: 1,
      skippedCount: 0,
      errors: ["pdf: access denied"],
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SkillsStorageSettings
          inline
          settings={
            {
              ...m.settings,
              showInTray: true,
              minimizeToTrayOnClose: true,
              language: "zh",
            } as SettingsFormState
          }
          onMigrated={onMigrated}
          onChange={onChange}
        />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "settings.skillSync.copy" }),
    );
    expect(onChange).toHaveBeenCalledWith({ skillSyncMethod: "copy" });
    expect(m.updateSettings).not.toHaveBeenCalled();
    expect(m.autoSaveSettings).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "settings.skillStorage.unified" }),
    );
    await userEvent.click(moveButton());
    await waitFor(() => expect(onMigrated).toHaveBeenCalledWith("unified"));
    expect(m.toastWarning).toHaveBeenCalledWith(
      "skills.storageSheet.movePartial",
      expect.objectContaining({ description: "pdf: access denied" }),
    );
  });

  it("rolls back and reports a failed sync preference save", async () => {
    m.autoSaveSettings.mockRejectedValue(new Error("disk full"));
    renderDialog();
    await userEvent.click(radio(/skills\.storageSheet\.syncCopy/));
    await waitFor(() =>
      expect(m.updateSettings).toHaveBeenLastCalledWith({
        skillSyncMethod: "auto",
      }),
    );
    expect(m.toastError).toHaveBeenCalledWith("settings.saveFailedGeneric");
  });

  it("keeps the inline migration modal open until the migration finishes", async () => {
    let finishMigration!: (result: {
      migratedCount: number;
      skippedCount: number;
      errors: string[];
    }) => void;
    m.migrate.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishMigration = resolve;
        }),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SkillsStorageSettings
          inline
          settings={{
            showInTray: true,
            minimizeToTrayOnClose: true,
            language: "zh",
          }}
          onMigrated={vi.fn()}
          onChange={vi.fn().mockResolvedValue(true)}
        />
      </QueryClientProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "settings.skillStorage.unified" }),
    );
    await userEvent.click(moveButton());
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("skills.storageSheet.moving");
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBe(dialog);
    const navigationShortcut = vi.fn();
    window.addEventListener("keydown", navigationShortcut);
    fireEvent.keyDown(window, { key: ",", ctrlKey: true });
    expect(navigationShortcut).not.toHaveBeenCalled();
    window.removeEventListener("keydown", navigationShortcut);
    expect(screen.getByRole("dialog")).toBe(dialog);
    finishMigration({ migratedCount: 0, skippedCount: 0, errors: [] });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("names the apps and Skills that did not sync", async () => {
    m.resync.mockResolvedValue([
      { app: "claude", ok: true, failedSkills: [] },
      {
        app: "codex",
        ok: false,
        failedSkills: [{ directory: "pdf", error: "symlink failed" }],
      },
      {
        app: "hermes",
        ok: false,
        error: "permission denied",
        failedSkills: [],
      },
    ]);
    renderDialog();

    await userEvent.click(
      screen.getByRole("button", { name: "skills.storageSheet.resync" }),
    );

    await waitFor(() => expect(m.toastWarning).toHaveBeenCalledTimes(1));
    const [title, options] = m.toastWarning.mock.calls[0];
    expect(title).toBe("skills.storageSheet.resyncPartial");
    expect(options.description).toContain("Codex");
    expect(options.description).toContain("Hermes: permission denied");
    expect(m.toastSuccess).not.toHaveBeenCalled();
  });

  it("closes from the solid Done button", async () => {
    const onOpenChange = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SkillsStorageSheet open onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "common.done" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
