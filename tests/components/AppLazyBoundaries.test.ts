import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * App.tsx 里懒加载组件挂载位置的审查。
 *
 * 懒加载组件第一次渲染时会抛出 Promise，交给最近的 Suspense 边界；没有边界时
 * 挂起会一路冒到根。App 之外只有 main.tsx 的 FrontendErrorBoundary，它不接
 * 挂起，结果是整屏换成「界面遇到了问题」。页头在正文边界之外，正文之外的
 * 浮层区也各有边界，所以这两处必须自己带边界。
 *
 * 真实的懒加载挂起在 jsdom 里需要模块解析竞态才复现，这里按源码位置断言，
 * 与 ProviderCardLayout / SelectContentScroll 的做法一致。
 */
const APP_SOURCE = readFileSync(
  resolve(__dirname, "../../src/App.tsx"),
  "utf8",
);

/** 该位置前面最近的 <Suspense 是否还没闭合（即它落在某个边界的 body 里） */
function insideSuspendBoundary(source: string, at: number): boolean {
  return (
    source.lastIndexOf("<Suspense", at) > source.lastIndexOf("</Suspense>", at)
  );
}

describe("lazy components stay inside a Suspense boundary", () => {
  it("keeps the usage script modal inside the dialog Suspense boundary", () => {
    const at = APP_SOURCE.indexOf("<UsageScriptModal");
    expect(at).toBeGreaterThan(-1);
    expect(insideSuspendBoundary(APP_SOURCE, at)).toBe(true);
  });

  it("wraps the lazily loaded memory save button in the page header", () => {
    const at = APP_SOURCE.indexOf("<HermesMemorySaveButton");
    expect(at).toBeGreaterThan(-1);
    expect(insideSuspendBoundary(APP_SOURCE, at)).toBe(true);
  });
});
