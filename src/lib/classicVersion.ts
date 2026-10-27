/**
 * CC Switch Classic 的版本常量（前端侧）。
 *
 * 版本号分两段管理（详见仓库根 MAINTENANCE.md §6）：
 * - CLASSIC_VERSION：Classic 维护线自己的主版本号，只有它更新才推送更新提示；
 *   ⚠️ 必须与 src-tauri/src/commands/misc.rs 的 CLASSIC_VERSION 同值 bump
 *   （v1.1.1 只改了本文件，更新判定滞留 1.1.0 造成提示死循环；Rust 侧有守卫单测）；
 * - 内核版本：上游 farion1231/cc-switch 的版本，即 tauri.conf 的 version
 *   （getVersion() 读到的就是它），跟随上游更新。
 */
export const CLASSIC_VERSION = "1.1.3";
