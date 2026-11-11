# Agent Note: 保留 Codex 官方模型镜像的 Fast 能力

Status: implemented（已实施）

## Problem（问题）

聚合模式为第三方供应商发布模型目录时，复用直连、路由的 `codex_official_model_entry`。旧实现把匹配到的官方 GPT 条目的 `service_tiers`、`additional_speed_tiers` 强制清空，导致 `cc-switch-model-catalog.json` 中的模型失去 Fast 能力；聚合模型加上 `ccs-*` 前缀后仍保留这份空元数据。手动修改生成文件会被后续投影覆盖。

对照 OpenAI Codex 提交 `fe2f18520864ddbee86cdd4b103a9fefffe9c6a2`：

- [协议模型定义](https://github.com/openai/codex/blob/fe2f18520864ddbee86cdd4b103a9fefffe9c6a2/codex-rs/protocol/src/openai_models.rs)：`ModelPreset::supports_fast_mode` 接受 `service_tiers` 中的 `priority` 或旧字段 `additional_speed_tiers` 中的 `fast`；后者已标记弃用。`ModelInfo::service_tier_for_request` 对 `priority` 只认可 `service_tiers` 的声明，因此仅补旧字段不能保证请求生效。
- [终端服务档选择](https://github.com/openai/codex/blob/fe2f18520864ddbee86cdd4b103a9fefffe9c6a2/codex-rs/tui/src/chatwidget/service_tiers.rs)：当前命令列表由 `service_tiers` 生成，并受客户端功能开关控制。`id` 为请求值，`name` 用于命令名称，`description` 是必填描述。
- [请求构造](https://github.com/openai/codex/blob/fe2f18520864ddbee86cdd4b103a9fefffe9c6a2/codex-rs/core/src/client.rs)：发送前调用上述服务档过滤。

## Decision（决定）

匹配官方条目的 GPT 模型保留原条目的两个速度字段，不再将其视为官方账号专属信息。复用既有官方目录来源和模型匹配规则，覆盖普通供应商目录及聚合的路由行、成员行。继续清除官方升级提示、禁用第三方不支持的 Responses Lite；不新增默认 Fast 配置。

未匹配的自定义模型不继承通用模板的 Fast 能力；Copilot、Anthropic 转换与厂商原生目录继续遵循原有能力来源。CC Switch 的 Responses→Chat 转换已经透传 `service_tier`，本次仅增加其回归断言。

更新后需由 CC Switch 重新生成目录，再重启 Codex。目录声明恢复客户端选择能力，不证明第三方网关已经实现优先处理；实际处理方式由上游服务决定。

## Alternatives considered（考虑过的方案）

- 给所有模型硬编码 Fast：会给未知模型及不兼容的协议虚构能力，不采用。
- 只修聚合输出：会遗漏直连、路由的同源缺陷，并重复能力规则，不采用。
- 仅补 `additional_speed_tiers`：不能满足当前请求过滤和命令生成，不采用。

## Consequences（收益与代价）

保留官方元数据使支持该能力的 GPT 模型恢复选择，并随官方目录演进。代价是用户通过第三方网关主动选择 Fast 后，网关仍可能拒绝或忽略 `priority`；本次不对供应商支持情况作额外承诺。

## Testing（验证）

审查基线为 `1e7273bbb8b320912de01c1a9f8aeffc37fa9a70`，对象为该基线上的本任务改动。验证覆盖原生 Responses、Chat 转换、聚合别名、无速度档的官方模型、未知模型及隔离的协议类型；确认普通请求不自动携带 Fast 参数。

Windows 上使用独立空目录设置 `CC_SWITCH_TEST_HOME`，配置模块的文件测试沿用共享锁与临时目录夹具，测试串行执行；构建使用显式 `CARGO_TARGET_DIR`。

- 修复前运行 `cargo test --locked --manifest-path src-tauri/Cargo.toml --lib fast_tiers_follow_the_matched_official_model -j2 -- --test-threads=1`，退出码 1：`openai/gpt-5.5` 在原生 Responses 下的 Fast 支持实际为 false、期望为 true，成功暴露旧缺陷。
- 修复后运行 `cargo test --locked --manifest-path src-tauri/Cargo.toml --lib codex_config::tests -j2 -- --test-threads=1`，90 项通过，退出码 0。
- 运行 `cargo test --locked --manifest-path src-tauri/Cargo.toml --lib proxy::providers::transform_codex_chat::tests -j2 -- --test-threads=1`，131 项通过，退出码 0。
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`、`pnpm docs:check`、`git diff --check` 均通过。
- 本机 Codex CLI 0.167.0 的 `codex debug models --bundled` 输出确认：其 `gpt-5.5` 条目同时携带 `service_tiers: priority` 和 `additional_speed_tiers: fast`，默认服务档为空。该命令只读取程序自带目录，不是客户端交互或真实服务验收。

两组修复后测试日志位于仓库外临时目录 `cc-switch-fast-source-20261111` 下的 `codex-config-tests.log`、`codex-chat-tests.log`。编译出现运行库 R6016 诊断后继续完成，并有原有的 `SystemKeychain::named` 未使用警告；均未造成最终测试失败。

未运行全目标测试、Clippy、macOS/Linux 或真实第三方服务验收。界面、翻译、数据库迁移、打包及发布不在本次改动范围；未使用真实账号或代理进行验证。
