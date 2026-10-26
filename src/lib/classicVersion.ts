/**
 * CC Switch Classic 的版本常量（唯一来源）。
 *
 * 版本号分两段管理（详见仓库根 AGENTS.md）：
 * - CLASSIC_VERSION：Classic 维护线自己的主版本号，只有它更新才推送更新提示；
 * - 内核版本：上游 farion1231/cc-switch 的版本，即 tauri.conf 的 version
 *   （getVersion() 读到的就是它），跟随上游更新。
 */
export const CLASSIC_VERSION = "1.1.0";
