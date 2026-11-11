# 文档目录

开发协作从 [AGENTS.md（统一入口）](../AGENTS.md) 和 [贡献规范](../CONTRIBUTING.md) 开始；完整阶段导航见 [维护入口](../MAINTENANCE.md)。

| 资料                                                                                 | 何时读                           | 性质                         |
| ------------------------------------------------------------------------------------ | -------------------------------- | ---------------------------- |
| [项目契约](maintenance/project-contract.md)                                          | 产品代码改动、界面适配           | 公开规范                     |
| [开发与验证](maintenance/development.md)                                             | 开发、测试和排错                 | 公开操作规程                 |
| [上游同步](maintenance/upstream-sync.md)                                             | 跟进官方内核                     | 公开操作规程                 |
| [功能筛查与适配裁决](maintenance/upstream-triage.md)                                 | 内核筛查、界面取舍与逐区域回归   | 公开判断标准                 |
| [模块开发手册](development/README.md)                                                | 改动对应模块前                   | 详细契约与验收，按需阅读     |
| [质量审查](maintenance/review.md)                                                    | 实现后、合并前                   | 公开门禁                     |
| [发布流程](maintenance/release.md)                                                   | 推送、打包和发版                 | 公开操作规程                 |
| [文档治理](maintenance/documentation.md)                                             | 新增或整理长期资料               | 公开规范                     |
| [用户手册](user-manual/README.md)                                                    | 理解用户操作                     | 用户文档，不覆盖项目契约     |
| [Kimi Code（编程工具）接入说明](development/kimi-code-integration.md)                | 修改对应原生配置、账号与会话集成 | 模块参考；界面遵守经典版裁决 |
| [更新摘要编写](../src/whats-new/README.md)                                           | 修改应用内更新提示               | 模块规范                     |
| [Flatpak（沙箱包）说明](../flatpak/README.md)                                        | 修改对应打包                     | 模块参考                     |
| [功能指南](guides/)、[历史发布说明](release-notes/)、[上游变更日志](../CHANGELOG.md) | 查来源、协议行为或历史变化       | 参考档案，不是当前维护指令   |
| [文档分层决策](decisions/implemented/process/2026-11-04-maintenance-docs.md)         | 需要理解或变更文档架构           | 决策依据                     |

截图与图片留在本目录的原有资源目录，避免破坏用户手册和主页引用；不因整理维护文档批量搬动用户资料。新增长期模块规范时在这里登记，只有被任务触发的模块才需要阅读。

## Codex（编程助手）提醒与模型列表

[未确认客户端提醒的本机静音](decisions/implemented/bug-fix/2026-11-05-codex-unverified-reminders.md)：提醒的证据强度、关闭与静音的作用范围，以及模型列表留空的说明。

[经典模型表单回退](decisions/implemented/bug-fix/2026-11-05-codex-classic-model-form.md)：独立默认模型、高级模型映射与升级配置保留。

[模型目录的 Fast 能力](decisions/implemented/bug-fix/2026-11-11-codex-catalog-fast-mode.md)：保留官方 GPT 模型的速度档元数据，覆盖直连、路由及聚合模型。
