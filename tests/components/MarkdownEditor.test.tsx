import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { describe, expect, it, vi } from "vitest";
import MarkdownEditor, {
  type MarkdownEditorHandle,
} from "@/components/MarkdownEditor";
import PromptFormPanel from "@/components/prompts/PromptFormPanel";
import { discardUnsavedChanges, hasUnsavedChanges } from "@/lib/unsavedChanges";

describe("MarkdownEditor", () => {
  it.each([false, true])(
    "keeps loaded prompt content outside undo history (asynchronous load: %s)",
    (asynchronous) => {
      discardUnsavedChanges();
      const prompt = {
        id: "existing",
        name: "Existing",
        content: "# Existing rules",
        enabled: false,
      };
      const props = {
        appId: "claude" as const,
        editingId: prompt.id,
        onSave: vi.fn(),
        onClose: vi.fn(),
      };
      const { rerender } = render(
        <PromptFormPanel
          {...props}
          initialData={asynchronous ? undefined : prompt}
        />,
      );
      if (asynchronous)
        rerender(<PromptFormPanel {...props} initialData={prompt} />);
      const textbox = screen.getByLabelText("prompts.content");
      const view = EditorView.findFromDOM(textbox)!;
      act(() => textbox.focus());
      fireEvent.keyDown(textbox, { key: "z", code: "KeyZ", ctrlKey: true });
      expect(view.state.doc.toString()).toBe(prompt.content);
      expect(hasUnsavedChanges()).toBe(false);
      fireEvent.keyDown(textbox, { key: "Enter", code: "Enter" });
      expect(view.state.doc.toString()).not.toBe(prompt.content);
      fireEvent.keyDown(textbox, { key: "z", code: "KeyZ", ctrlKey: true });
      expect(view.state.doc.toString()).toBe(prompt.content);
      fireEvent.keyDown(textbox, { key: "z", code: "KeyZ", ctrlKey: true });
      expect(view.state.doc.toString()).toBe(prompt.content);
    },
  );
  it("tracks prompt edits made by editor keyboard commands without marking the initial load dirty", () => {
    discardUnsavedChanges();
    render(
      <PromptFormPanel
        appId="claude"
        editingId="rules"
        initialData={{
          id: "rules",
          name: "Rules",
          content: "# Rules",
          enabled: false,
        }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const textbox = screen.getByLabelText("prompts.content");
    expect(hasUnsavedChanges()).toBe(false);
    act(() => textbox.focus());
    fireEvent.keyDown(textbox, { key: "Enter", code: "Enter" });
    expect(EditorView.findFromDOM(textbox)!.state.doc.toString()).not.toBe(
      "# Rules",
    );
    expect(hasUnsavedChanges()).toBe(true);
  });
  it("focuses the real editor and preserves edits and undo across saving, validation and theme changes", () => {
    const handle = createRef<MarkdownEditorHandle>();
    const changed = vi.fn();
    function Editor({
      readOnly = false,
      invalid = false,
    }: {
      readOnly?: boolean;
      invalid?: boolean;
    }) {
      const [value, setValue] = useState("# Rules");
      return (
        <>
          <span id="body-label">Instructions</span>
          <span id="body-help">Editor help</span>
          <MarkdownEditor
            ref={handle}
            value={value}
            onChange={(text) => {
              changed(text);
              setValue(text);
            }}
            aria-labelledby="body-label"
            aria-describedby="body-help"
            aria-invalid={invalid}
            readOnly={readOnly}
            darkMode={invalid}
            placeholder={invalid ? "Updated placeholder" : "Write instructions"}
          />
        </>
      );
    }
    const { rerender } = render(<Editor />);
    const textbox = screen.getByRole("textbox", { name: "Instructions" });
    const view = EditorView.findFromDOM(textbox)!;
    expect(textbox).toHaveAccessibleDescription("Editor help");
    act(() => {
      handle.current!.focus();
      view.dispatch({
        changes: { from: view.state.doc.length, insert: "\nKeep the draft" },
      });
    });
    expect(textbox).toHaveFocus();
    expect(changed).toHaveBeenLastCalledWith("# Rules\nKeep the draft");
    rerender(<Editor readOnly invalid />);
    expect(
      EditorView.findFromDOM(
        screen.getByRole("textbox", { name: "Instructions" }),
      ),
    ).toBe(view);
    expect(textbox).toHaveAttribute("contenteditable", "false");
    expect(textbox).toHaveAttribute("aria-readonly", "true");
    expect(textbox).toHaveAttribute("aria-invalid", "true");
    expect(view.state.doc.toString()).toBe("# Rules\nKeep the draft");
    rerender(<Editor />);
    act(() => handle.current!.focus());
    fireEvent.keyDown(textbox, { key: "z", code: "KeyZ", ctrlKey: true });
    expect(view.state.doc.toString()).toBe("# Rules");
    expect(changed).toHaveBeenLastCalledWith("# Rules");
  });

  it("uses the latest change callback without recreating the editor", () => {
    const originalChange = vi.fn();
    const latestChange = vi.fn();
    const { rerender } = render(
      <MarkdownEditor
        value="original"
        onChange={originalChange}
        aria-label="Body"
      />,
    );
    const view = EditorView.findFromDOM(
      screen.getByRole("textbox", { name: "Body" }),
    )!;
    rerender(
      <MarkdownEditor
        value="original"
        onChange={latestChange}
        aria-label="Body"
        minHeight="167px"
      />,
    );
    act(() =>
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: "edited" },
      }),
    );
    expect(originalChange).not.toHaveBeenCalled();
    expect(latestChange).toHaveBeenLastCalledWith("edited");
    expect(
      EditorView.findFromDOM(screen.getByRole("textbox", { name: "Body" })),
    ).toBe(view);
  });
});
