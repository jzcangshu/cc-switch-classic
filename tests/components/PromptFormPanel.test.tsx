import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PromptFormPanel from "@/components/prompts/PromptFormPanel";
import type { Prompt } from "@/lib/api";
import type { ComponentProps } from "react";
import type MarkdownEditor from "@/components/MarkdownEditor";

vi.mock("@/components/MarkdownEditor", async () => {
  const { forwardRef } = await import("react");
  return {
    default: forwardRef<
      HTMLTextAreaElement,
      ComponentProps<typeof MarkdownEditor>
    >((props, ref) => (
      <textarea
        ref={ref}
        id={props.id}
        value={props.value}
        onChange={(event) => props.onChange?.(event.target.value)}
        disabled={props.readOnly}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-invalid={props["aria-invalid"]}
      />
    )),
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.file ? `${key}:${String(options.file)}` : key,
  }),
}));

const active: Prompt = {
  id: "team",
  name: "Team rules",
  content: "# Rules",
  enabled: true,
  createdAt: 1,
  updatedAt: 1,
};

describe("PromptFormPanel", () => {
  it("submits once and refuses to close while saving", async () => {
    let resolveSave!: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const onClose = vi.fn();
    render(
      <PromptFormPanel appId="claude" onSave={onSave} onClose={onClose} />,
    );

    const nameInput = screen.getByLabelText(/prompts.name/);
    fireEvent.change(nameInput, { target: { value: "My Prompt" } });
    const saveButton = screen.getByRole("button", {
      name: "common.save",
    });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(nameInput).toBeDisabled();
    expect(screen.getByLabelText("prompts.content")).toBeDisabled();

    await act(async () => {
      resolveSave();
      await Promise.resolve();
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("stays open when the parent write lock rejects a save", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    const onClose = vi.fn();
    render(<PromptFormPanel appId="codex" onSave={onSave} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/prompts.name/), {
      target: { value: "Codex Prompt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/prompts.name/)).toBeEnabled();
  });

  it("explains a missing name only after a save attempt", () => {
    const onSave = vi.fn();
    render(
      <PromptFormPanel appId="hermes" onSave={onSave} onClose={vi.fn()} />,
    );

    expect(
      screen.queryByText("prompts.nameRequiredHermes"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    expect(screen.getByText("prompts.nameRequiredHermes")).toBeInTheDocument();
    expect(screen.getByLabelText(/prompts.name/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/prompts.name/)).toHaveFocus();
  });

  it("keeps the common save label and names the overwritten file beside the content", () => {
    render(
      <PromptFormPanel
        appId="hermes"
        editingId="team"
        initialData={active}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "common.save" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("prompts.saveAndOverwrite:SOUL.md"),
    ).toBeInTheDocument();
    // 删除只在列表里，编辑页底栏只有取消和保存
    expect(
      screen.queryByRole("button", { name: "common.delete" }),
    ).not.toBeInTheDocument();
  });

  it("keeps Pi content as typed and writes AGENTS.md for the enabled prompt", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <PromptFormPanel
        appId="pi"
        editingId="team"
        initialData={active}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("prompts.content"), {
      target: { value: "  spaced\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        "team",
        expect.objectContaining({ content: "  spaced\n", enabled: true }),
      ),
    );
  });

  it("refuses MiniMax Code prompts over 32 KB", () => {
    const onSave = vi.fn();
    render(<PromptFormPanel appId="mcode" onSave={onSave} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/prompts.name/), {
      target: { value: "Big" },
    });
    fireEvent.change(screen.getByLabelText("prompts.content"), {
      target: { value: "a".repeat(32 * 1024 + 1) },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    expect(screen.getByText("prompts.mcodeTooLarge")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText("prompts.content")).toHaveFocus();
    expect(screen.getByLabelText("prompts.content")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      screen.getByLabelText("prompts.content"),
    ).toHaveAccessibleDescription(/prompts.mcodeTooLarge/);
  });

  it("keeps the edited body after a failed save and unlocks the editor", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("write failed"));
    const onClose = vi.fn();
    render(
      <PromptFormPanel
        appId="claude"
        initialData={active}
        editingId="team"
        onSave={onSave}
        onClose={onClose}
      />,
    );
    const body = screen.getByLabelText("prompts.content");
    fireEvent.change(body, { target: { value: "# Edited\nKeep this draft" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: "common.save",
      }),
    );
    await waitFor(() => expect(body).toBeEnabled());
    expect(onClose).not.toHaveBeenCalled();
    expect(body).toHaveValue("# Edited\nKeep this draft");
  });

  it("applies the MiniMax limit to UTF-8 bytes rather than character count", () => {
    const onSave = vi.fn();
    render(
      <PromptFormPanel
        appId="mcode"
        initialData={active}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("prompts.content"), {
      target: { value: "汉".repeat(11_000) },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    expect(screen.getByText("prompts.mcodeTooLarge")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
