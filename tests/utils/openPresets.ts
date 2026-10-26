import { fireEvent } from "@testing-library/react";

/**
 * 预设供应商默认折叠（2026-10-26 决策，见 MAINTENANCE.md）。
 * 需要点预设的用例先展开；表单里没有预设区时是空操作。
 *
 * 用 aria-controls 定位而不是文案：有的测试用真实翻译，按钮名不是 i18n key。
 */
export function openPresets() {
  const toggle = document.querySelector<HTMLButtonElement>(
    'button[aria-controls="provider-preset-body"]',
  );
  if (toggle?.getAttribute("aria-expanded") === "false") {
    fireEvent.click(toggle);
  }
}
