/**
 * CC Switch Classic 的仓库与版本信息（唯一来源）。
 *
 * 版本规则（详见仓库根 AGENTS.md）：
 * - Classic 主版本：本维护线自己的版本号，只有它更新才推送更新提示；
 * - 内核版本：上游 farion1231/cc-switch 的版本（tauri.conf 的 version），跟随上游更新，
 *   更新日志只放已跟进的内核变更。
 */
export const REPO_OWNER = "jzcangshu";
export const REPO_NAME = "cc-switch-classic";
export const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
export const RELEASES_URL = `${REPO_URL}/releases`;

/** GitHub Releases API：最新 Classic 版本的 release（未建库/无 release 时请求方自行处理） */
export const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
