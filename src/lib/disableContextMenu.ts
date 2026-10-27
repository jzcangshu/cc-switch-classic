/** 可编辑区域保留原生右键菜单（复制、粘贴、拼写检查等）。 */
const EDITABLE_SELECTOR =
  "input, textarea, select, [contenteditable='true'], .cm-editor";

/**
 * 屏蔽 WebView 的默认右键菜单。
 *
 * 桌面端（Tauri / WebView2）右键会弹出「后退 / 刷新 / 另存为 / 打印 / 更多工具」等
 * 浏览器菜单，对应用没有意义。这里在 window 捕获阶段统一 preventDefault，
 * 既能盖住整窗，也不会阻止组件自己的 contextmenu 处理逻辑继续执行。
 * 可编辑区域和选中的只读文本例外：保留原生菜单，右键复制/粘贴仍然可用。
 */
export function disableContextMenu() {
  // 测试 / SSR 等非浏览器环境直接跳过，导入本模块本身不会产生副作用。
  if (typeof window === "undefined") return;

  window.addEventListener(
    "contextmenu",
    (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(EDITABLE_SELECTOR)) {
        return;
      }
      if (window.getSelection()?.toString()) {
        return;
      }
      event.preventDefault();
    },
    true,
  );
}
