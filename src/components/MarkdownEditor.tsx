import React, {
  forwardRef,
  useRef,
  useEffect,
  useMemo,
  useImperativeHandle,
} from "react";
import { EditorView, basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import { placeholder as placeholderExt } from "@codemirror/view";

export interface MarkdownEditorHandle {
  focus: () => void;
}

interface MarkdownEditorProps
  extends Pick<
    React.AriaAttributes,
    "aria-label" | "aria-labelledby" | "aria-describedby" | "aria-invalid"
  > {
  id?: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  darkMode?: boolean;
  readOnly?: boolean;
  className?: string;
  minHeight?: string;
  maxHeight?: string;
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  (
    {
      id,
      value,
      onChange,
      placeholder: placeholderText = "",
      darkMode = false,
      readOnly = false,
      className = "",
      minHeight = "300px",
      maxHeight,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledBy,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
    },
    ref,
  ) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const configurationSlot = useRef(new Compartment()).current;
    const initialValue = useRef(value);
    useImperativeHandle(
      ref,
      () => ({ focus: () => viewRef.current?.focus() }),
      [],
    );

    const configuration = useMemo(() => {
      // 定义基础主题
      const baseTheme = EditorView.baseTheme({
        "&": {
          height: "100%",
          minHeight,
          maxHeight: maxHeight || "none",
        },
        ".cm-scroller": {
          overflow: "auto",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          fontSize: "14px",
        },
        "&light .cm-content, &dark .cm-content": {
          padding: "12px 0",
        },
        "&light .cm-editor, &dark .cm-editor": {
          backgroundColor: "transparent",
        },
        "&.cm-focused": {
          outline: "none",
        },
      });

      const extensions = [
        baseTheme,
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        EditorView.contentAttributes.of({
          role: "textbox",
          "aria-multiline": "true",
          "aria-readonly": String(readOnly),
          "aria-invalid": String(ariaInvalid ?? false),
          ...(id ? { id } : {}),
          ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
          ...(ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : {}),
          ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
        }),
      ];

      if (!readOnly) {
        extensions.push(placeholderExt(placeholderText));
      } else {
        // 只读模式下隐藏光标和高亮行
        extensions.push(
          EditorView.theme({
            ".cm-cursor, .cm-dropCursor": { border: "none" },
            ".cm-activeLine": { backgroundColor: "transparent !important" },
            ".cm-activeLineGutter": {
              backgroundColor: "transparent !important",
            },
          }),
        );
      }

      // 如果启用深色模式，添加深色主题
      if (darkMode) {
        extensions.push(oneDark);
      } else {
        // 浅色模式下的简单样式调整，使其更融入 UI
        extensions.push(
          EditorView.theme(
            {
              "&": {
                backgroundColor: "transparent",
              },
              ".cm-content": {
                color: "#374151", // text-fg-1
              },
              ".cm-gutters": {
                backgroundColor: "#f9fafb", // bg-subtle
                color: "#9ca3af", // text-fg-3
                borderRight: "1px solid #e5e7eb", // border-border
              },
              ".cm-activeLineGutter": {
                backgroundColor: "#e5e7eb",
              },
            },
            { dark: false },
          ),
        );
      }

      return extensions;
    }, [
      darkMode,
      readOnly,
      minHeight,
      maxHeight,
      placeholderText,
      id,
      ariaLabel,
      ariaLabelledBy,
      ariaDescribedBy,
      ariaInvalid,
    ]);

    useEffect(() => {
      if (!editorRef.current) return;
      // 编辑器只随组件挂载/卸载创建销毁，保存锁、主题和提示文字更新不清空撤销历史。
      const state = EditorState.create({
        doc: initialValue.current,
        extensions: [
          basicSetup,
          markdown(),
          EditorView.lineWrapping,
          configurationSlot.of(configuration),
          EditorView.updateListener.of((update) => {
            if (update.docChanged)
              onChangeRef.current?.(update.state.doc.toString());
          }),
        ],
      });

      // 创建编辑器视图
      const view = new EditorView({
        state,
        parent: editorRef.current,
      });

      viewRef.current = view;

      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: configurationSlot.reconfigure(configuration),
      });
    }, [configuration, configurationSlot]);

    // 当 value 从外部改变时更新编辑器内容
    useEffect(() => {
      if (viewRef.current && viewRef.current.state.doc.toString() !== value) {
        const transaction = viewRef.current.state.update({
          // 外部加载/同步属于编辑基线，不能成为用户撤销时清空正文的一步。
          annotations: Transaction.addToHistory.of(false),
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: value,
          },
        });
        viewRef.current.dispatch(transaction);
      }
    }, [value]);

    return (
      <div
        ref={editorRef}
        className={`border rounded-md overflow-hidden ${
          darkMode ? "border-border-strong" : "border-border"
        } ${className}`}
      />
    );
  },
);

MarkdownEditor.displayName = "MarkdownEditor";

export default MarkdownEditor;
