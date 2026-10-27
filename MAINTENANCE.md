# CC Switch Classic 维护必读

> **唯一必读，也是唯一的记忆库。** 所有 Agent 的裁决、经验、踩坑都追加到这里，不再另写 memory / notes 文档。
> 本文会入库，**禁止写入个人路径、密钥、账号、本机目录等隐私信息**；本地专属的操作细节留在不入库的 `AGENTS.md`。
> 与代码或旧笔记冲突时以本文为准；要推翻任何一条，先改本文并写清理由，再改代码。
> **每个环节动手前必读本文对应章节**（发版 / 更新 / 备份 / 镜像 / 裁决……），禁止凭记忆执行清单——2026-10-27 v1.1.1 版本常量漏 bump 事故即源于「规则在文中、执行凭记忆」（§6 判例）。

---

## 0. 一页速览

| 项目 | 值 |
|---|---|
| 产品 | **CC Switch Classic**（界面、关于页、打包产物统一用此名，不得出现裸「CC Switch」） |
| 定位 | 上游 V4 内核（数据层 / 后端 / 业务钩子）+ 第三版（v3.20.4）视觉与操作风味 |
| 三参照 | 视觉参照 = tag `v3.20.4`；我方层 = 开发分支 `codex/v3-classic-v4-core`；上游变更 = `origin` 的新 tag |
| 仓库 | `classic` = 本仓库（`main` 为干净镜像）；`origin` = V4 上游；禁止在任何用户可见处指向上游或 ccswitch.io |
| 版本 | 双段：Classic 主版本（`classicVersion.ts` + `misc.rs`，两处同步）与内核版本（`tauri.conf.json`） |
| 语言 | 四语言：zh / zh-TW / en / ja |
| 当前基线 | 内核 v4.0.20（Oh My Pi 为第 13 个应用、Kimi 官方账号、应用页分组与拖动） |

---

## 1. 三条裁决规则（用户 2026-10-24 确立）

1. **范围**：只考虑「易改 / 中等」成本。"no" 级（V3 无对应物）里只动**纯界面附加物**（多余按钮、徽章、菜单），带数据/带功能的新增一律保留。
2. **红线**：改回后不得出现——大量逻辑重构；严重误导或与事实冲突；严重体验恶化（遮挡、溢出、盲滚、触屏不可用、失去防误操作保护）。
3. **动机**：只改会让 V3 老用户产生**陌生感**的：按钮样式与颜色、徽章、品牌元素、页面命名、多余入口。纯行为优化与单纯信息增减不动。

三条全满足才改回 / 适配；任一不满足即保留 V4。

## 2. 五类裁决

| 裁决 | 含义 | 默认适用 |
|---|---|---|
| `adopt` | 直接跟进 | 后端 / 内核、配置修复、事实修正、测试 |
| `adapt` | 跟进但界面按 V3 形态适配 | 新功能要露 UI；已 V3 化区域的逻辑增强 |
| `coreOnly` | 只取逻辑 / 数据层 | 上游对已恢复区域做的 V4 风改版 |
| `skip` | 不跟进 | 纯 V4 皮肤变化、与定位冲突项 |
| `verify` | 列给人复核 | 规则相抵触、影响面大、涉 updater / 发布 |

## 3. 判例（先例优先，不可违背）

1. **入口类改动优先「恢复成 V3 已有形态」，而不是删功能**（供应商搜索事件：先整体移除，后改为恢复 V3 浮动面板）。删功能只在功能本身无价值时。
2. **防误操作保护一律保留**：未保存离开确认、删除确认与撤销、禁用原因悬停说明、搜索时禁用收起、直连格式警告。
3. **决策记录在案的保留项不动**：模式查看与实际生效分离、触屏/窄屏直显卡片操作、会话结构化时间线、技能批量操作折叠区、目录草稿保护。改动需先重写决策记录。
4. **事实准确性压过 V3 文案**：工具清单含新 CLI、空状态描述、倍率与连通检测不复活；V3 文案与事实不符时以事实为准。
5. **结构性冲突维持 V4 并记录**：提示词页内页头、MCP 编辑抽屉（键名模型）、会话阅读器结构——恢复 V3 会杀掉保留的 V4 功能时不做。
6. **说明可见性**：页面级结构恢复（手风琴 / 小节形态）时，结构内常驻说明随之恢复；**单独的**字段提示 / 小字不反向恢复。
7. **行为优化与默认值保留 V4**；显式例外：额度默认显示已翻转为「已用」（设置项保留）。
8. **视觉底层修复保留 V4**：滚动条常显、自绘勾选框 / 输入框、浮层动画、主题瞬切、中文字体栈、键盘才显示焦点框。
9. **adapt 的标准做法是混合**：V3 形态 + V4 数据并存（玻璃汇总卡保留成功率 / 币种换算；查询失败态恢复 V3 胶囊、报错详情挪悬停与展开；关于页 V3 版式保留近期更新与便携提示）。
10. **常驻按钮优先于 ⋯ 菜单**：设为默认 Zap、账号行「重新登录 / 使用此账号 / ×」、Pi 模板行编辑 / 删除直显；⋯ 只留 V4 新功能项。
11. **文案裁决必须还原成实际中文再比对**，不比较 i18n key；V3 已有的键照抄 v3.20.4 原文。

## 4. 已恢复清单（每次合并上游后逐项确认没被覆盖）

Windows 原生标题栏；页头模式徽章移除；橙色圆形添加钮；品牌字动效（指向本仓库）；页头用量入口与独立更新按钮；二级页长标题；官方徽章与整卡变淡移除；队列上下移按钮移除；设为默认常驻 Zap；加入按钮蓝色；额度默认「已用」（设置保留）；认证中心标题 / 简介头 / 组名副标题 / 账号行常驻按钮；MCP 按钮文案与「自定义」胶囊；Pi 模板行直显按钮；路由页手风琴；配置目录紧凑单列；通用页小节形态与内联说明；关于页第三版版式；应用页卡片网格与环境徽章；会话恢复命令预览条与常驻删除；数据来源页内三卡；models.dev 整卡；用量玻璃汇总卡；设置页签蓝色胶囊；弹窗毛玻璃遮罩与标题底条带。

事后追加：供应商搜索 = V3 浮动面板；查询失败态「查询失败」胶囊 + 详情挪悬停；关于页内嵌应用管理（无独立应用页）；仓库指向本仓库。

## 5. 已废弃决策（**不得复活**）

| 决策 | 日期 | 结论 |
|---|---|---|
| **土耳其语（tr）** | 2026-10-26 | 整语言删除：语言包、i18n 资源、语言选项、类型联合、托盘与配置报错文案、语言白名单全部移除；旧设置里的 `"tr"` 回落英文。四语言，不再增加 |
| **赞助商置顶预设** | 2026-10-26 | 删除 372 个带 `primePartner` / `partnerPromotionKey` 的转售与聚合预设，只保留知名直营：Kimi 四款（月之暗面）、火山双 Plan / Doubao / BytePlus（字节）、Google Official；`primePartner` 字段与「尊享合作伙伴」置顶排序、爱心角标一并删除 |
| **「只保留账号登录预设」的过滤方案** | 2026-10-26 | 不采纳（PR #9）：只留 `presetGroup === "login"` 会让 Pi / Mcode / Kimi 预设列表变空，且牵连 44 个测试；该 PR 的按钮 `whitespace-nowrap` 修复已采纳 |
| **预设供应商默认展开** | 2026-10-26 | 改为默认折叠：标题行显示数量，点击展开；「自定义配置」常驻第一格 |
| **V4 用量设置抽屉 / 指标条 / 级联筛选** | 2026-10-26 | 不跟进：保留玻璃汇总卡 + 两个独立下拉 + 趋势图自带指标切换；用量显示与列选择留在「设置」页签内。唯一采纳的是「明细页签数量一次全显」 |
| **V4 应用页整表形态** | 2026-10-26 | 只取「已安装 / 未安装」分组与拖动把手；保留卡片网格 |
| **账号行 ⋯ 菜单** | 2026-10-26 | 不跟进，沿用常驻按钮 |
| **融合版分支 `codex/v3-ui-v4-core`** | 2026-10-25 | 已彻底删除（本地 / 两远端 / worktree），勿恢复、勿在文档中引用 |
| **上游专用仓库文件** | 2026-10-25 | 不带回：`dependabot.yml`、`CODEOWNERS`、`FUNDING.yml`、上游专用 workflows、`.agents/`、`AGENTS.md`、`CLAUDE.md` |

## 6. 版本与发布

- **双段版本**：Classic 主版本从 `1.0.0` 起（两处常量同步）；内核版本跟随上游。关于页同时显示两者。
- **发布什么就升什么**：跟进内核升 minor，纯界面修复升 patch。
- **版本号判例（2026-10-27，v1.1.1，用户裁决）**：minor **只**跟内核版本走；凡未跟内核的发布**一律升 patch——哪怕包含新功能/新能力**（如 OMP 用量导入归入 v1.1.1）。禁止套用通用 semver 的"有新功能就该升 minor"直觉；这条优先于上一条的模糊读法。
- 发布 = 推 tag `v{classic}`。Release 工作流全平台构建：Windows x64/ARM64 **NSIS** + 便携 zip、Linux x64/ARM64 AppImage/deb/rpm、macOS universal 未签名 dmg/zip。
- 便携包命名：`CC-Switch-Classic-v{classic}-Windows[-arm64]-Portable.zip`。
- **必须非 prerelease**：应用内更新读 `releases/latest/download/latest.json`，GitHub 的 latest 指针不含 prerelease。
- Windows 安装器**只能用 NSIS**（MSI 同 ProductVersion 无法覆盖安装）。
- macOS 未签名：App 内自动更新不可用；`latest.json` 的 platforms 只含 windows×2 + linux×2。
- 发布前在 `src/whats-new/{classic}.json` 写**已跟进的内核变更**，不引用未跟进的上游版本。
- **发布清单（每次 release 逐项过）**：① bump **两处** Classic 版本常量且必须同值：`src/lib/classicVersion.ts` 的 `CLASSIC_VERSION`（关于页显示）与 `src-tauri/src/commands/misc.rs` 的 `CLASSIC_VERSION`（更新判定基准）。两处不同步会被守卫单测 `classic_version_stays_in_sync_with_the_frontend_constant`（misc.rs 测试模块，`include_str!` 读 TS 文件断言相等）直接拦下；原测试模块的影子常量副本已于 v1.1.2 删除，勿再引入；② 写 `src/whats-new/{classic}.json`；③ bump README 头部 `Classic`、`内核` 两个 shields 徽标（v1.1.0 发布时漏了，滞留 v1.0.1/v4.0.18 到 2026-10-27 才补）；④ 涉及面大时补 `docs/release-notes/`；⑤ 推 tag。
- **版本口径判例（2026-10-27）**：应用内指向 classic 仓库 release tag 的链接（关于页「更新日志」、新版布局弹窗「查看更新说明」）必须用 `CLASSIC_VERSION` 拼 tag——`getVersion()` 读到的是**内核版本**，classic 仓库没有对应 tag，拼上去 404。以后新增任何「带版本号的站外链接」先问一句：这是 Classic 版还是内核版？可用更新的目标版本用 `updateInfo.availableVersion`（它本来就是 Classic 口径）。
- **版本常量两处同步判例（2026-10-27，v1.1.1 事故，用户裁决「不要再犯」）**：Classic 版本常量有两处——TS `src/lib/classicVersion.ts`（关于页显示）与 Rust `src-tauri/src/commands/misc.rs`（更新判定：`get_classic_update` 与 `install_update_and_restart` 的 version_comparator 都以它为准）。v1.1.1 发布只 bump 了 TS 一侧，Rust 滞留 `1.1.0`，导致所有 v1.1.1 用户关于页永久提示「新版本 v1.1.1」，点「立即更新」还会按同一判定把 v1.1.1 重装一遍、重启后继续提示（自我更新死循环），只能再发 v1.1.2 止血。教训：**清单必须逐文件枚举**——「两处同步」写在速览里而旧清单①只列了一个文件，照单执行照样漏。守卫（随 v1.1.2 落地）：Rust 单测 `include_str!` 读 classicVersion.ts，断言两常量相等。

## 7. 更新机制（红线）

- 更新检查走 `get_classic_update`（读本仓库 latest release 的 tag 与 Classic 主版本比较）；**只有 Classic 主版本变化才提示**，内核变化不提示。
- `tauri.conf.json` 的 updater endpoints 指向本仓库；**禁止**恢复直连上游 endpoint。
- `install_update_and_restart` 的 `version_comparator` 钩子别删，口径必须与 `get_classic_update` 一致（插件默认拿 latest.json 版本与内核版本严格比较，双段版本下永远为假）。
- 签名私钥只在本机、不入库不外传；GitHub secrets 存**密钥内容**（不是路径，v2 CLI 会把路径当 base64 解码失败）。

## 8. 工程约定与踩坑

- **i18n**：四语言同步；上游新增 key 四语言一起补。
- **Rust**：本机 1.95 初始化失败时用 `RUSTUP_TOOLCHAIN=stable`（不改仓库 `rust-toolchain.toml`）；跑 Rust 测试要防 HOME 回退污染真实 `~/.cc-switch`。
- **推送前三关**：`pnpm format:check`、`pnpm typecheck`、`cargo fmt --check --manifest-path src-tauri/Cargo.toml`；Rust 改动加跑 clippy。
- **测试判例**：全量跑挂的用例先单文件复跑再定性——并发负载会造成超时假失败，只有单跑仍挂才算回归。
- **平台分叉判例（2026-10-26 已修复，取代早先的「测试隔离」误诊）**：`App.test.tsx` 的「top edge resize / Tauri dragging」用例曾在 CI（Linux）稳定失败，根因**不是**测试隔离——是 `ClassicHeader` 无条件 spread 模块级常量 `DRAG_REGION_ATTR`，而该常量在模块加载时用**真实** `isLinux()`（UA 判断，jsdom 的 UA 含 `process.platform`）求值：Windows 上带 `data-tauri-drag-region`、Linux 上为 `{}`。于是 Linux 开启应用内窗口按钮时主 header 没有拖动区，`App.tsx` 边缘 mousedown 的 `stopPropagation`（要求目标带该属性）不触发，用例正确地抓住了这个真实产品 bug。修复=对齐上游 `AppPageHeader` 的条件模式（`windowControls ? { "data-tauri-drag-region": true } : DRAG_REGION_ATTR`）。教训：**测试 mock 掉的 `isLinux()` 只覆盖函数调用，盖不住模块加载期用它算出的常量**；本机（Windows）与 CI（Linux）因此分叉。复现手法：临时让 `platform.ts` 的 `isLinux` 直接 `return true` 即可在 Windows 上复刻 CI 失败。另注：单独 `-t` 跑该文件必挂是冷启动 `await import("@/App")` 的转换耗时贴着 5s 测试超时，与产品无关，整文件跑不受影响。
- **测试契约**：`data-tool-row`、`data-account-row`、`aria-controls="provider-preset-body"` 这类钩子被测试依赖，改名要同步改测试；预设区默认折叠，测试用 `tests/utils/openPresets.ts` 展开。
- **CI 陷阱**：`ci.yml` 的路径过滤依赖父提交，Detect 作业必须 `fetch-depth: 0`，否则 push 触发时静默判成「无改动」、整套检查被跳过（2026-10-26 修复）。
- CI 的 `CARGO_PROFILE_DEV_DEBUG=0` 与 Linux 清理预装大件步骤别删，删了会复现 ubuntu-22.04 磁盘爆满。
- 全局共享 UI 原语（`ui/dialog.tsx`、`ui/tabs.tsx`）已 V3 化，合并上游时逐项对照，不可直接采用上游版本。
- 提交信息用中文，风格参照 `git log`；临时脚本用完即删，别跟着 `git add -A` 进库。

**V3 设计语言速查（adapt 的实施标准）**：添加供应商 = 橙色圆形按钮；「加入」= 蓝底；「使用中」= 主色实底禁用；设置页签选中 = 蓝底白字胶囊；卡片操作组悬停显示（触屏 / 窄屏常驻）；汇总区 = 玻璃卡 + 品牌图标 + 短数徽章；弹窗遮罩压暗 + 毛玻璃，标题 / 底条浅灰条带；二级页用 V3 全称命名；Windows 原生标题栏。

## 9. 同步到远端 main

远端 `main` 是干净树，用孤儿提交整树镜像：

```bash
git fetch classic
C=$(git commit-tree HEAD^{tree} -p "$(git rev-parse classic/main)" -m "提交说明")
git push classic "$C:refs/heads/main"
```

⚠️ **推送前必查网页端直改**：用户会直接在 GitHub 网页编辑 README，整树镜像会覆盖。先看远端 main 最新提交是否含 "Update README.md" 类提交；若有，先 `git show classic/main:README.md > README.md` 再镜像（已实际覆盖过多次）。

⚠️ CI 只在 `main` 的 push 与对 `main` 的 PR 上跑；推开发分支不会触发。

## 10. 文档与记忆约定

| 文件 | 入库 | 作用 |
|---|---|---|
| `MAINTENANCE.md`（本文） | 是 | **唯一必读 + 唯一记忆库**：裁决规则、先例、已恢复清单、已废弃决策、发布与更新红线、工程踩坑 |
| `AGENTS.md` | 否（gitignore） | 本地专属操作（截图脚本、mock、本机路径等），不承载项目知识 |
| `docs/release-notes/` | 是 | 每个内核版本的发布说明（上游原文） |
| `CHANGELOG.md` | 是 | 上游变更记录 |
| 架构决策全文 | 历史提交 | `git show 918035d9:.agents/notes/implemented/architecture/2026-10-23-v3-ui-v4-core.md` |

**记忆写在哪**：新经验、新踩坑、新裁决 → 直接追加到本文对应小节；不要新建 memory / notes 文件，也不要写个人环境细节（本机路径、密钥、账号）。
