# 对话式剧本创作实施计划

**Goal:** 用户创建名称后持续与 AI 讨论和修改剧本，满意后显式保存正式版本；刷新不丢失成功对话和工作草稿。

**Architecture:** 沿用 Java 权威业务与 Next.js 界面。每个项目一个持久化创作对话，独立于正式版本，保存当前结构化草稿与历史消息。模型每轮接收最近对话及最新完整草稿，返回说明和更新文档。数据库租约阻止并发生成，版本校验阻止覆盖其他窗口。

**Tech Stack:** 现有 Spring Boot/MyBatis/MySQL（演示 H2）、Responses JSON Schema、Next.js/React Query。用户已要求实现上述交互流程；沿用现有供应商配置，不读取或提交私有密钥。

## 任务 1：持久对话和模型上下文

Files: `Models.java`, `AiPlanner.java`, `ConversationMapper.java`, `ConversationService.java`, `ConversationController.java`, `schema.sql`, `ConversationTest.java`, `AiPlannerTest.java`。

- [x] 先写行为测试：连续两轮草稿累积、项目修订不变；刷新恢复对话；显式保存创建新修订；账号隔离；上游失败释放生成租约；并发项目更新阻止覆盖；旧对话版本与同时请求拒绝。
- [x] `AiPlanner.converse(String message, Project project, Document draft, List<ChatMessage> history)` 返回 `ChatReply(reply, document)`。共享现有错误脱敏；严格 envelope schema；最近 12 条消息及完整最新草稿进入请求，不依赖供应商 conversation ID。
- [x] `GET /projects/{id}/conversation` 初始化/读取；`POST .../turns` 以 expectedVersion/expectedRevision 校验，先取得 120 秒租约，再在事务外调用模型，最后锁项目行并校验/提交对话；失败释放租约且保留已完成轮次。
- [x] `POST .../save` 将当前对话文档保存为新项目修订，并推进对话 baseRevision；`POST .../rebase` 保留历史说明，将草稿同步到当前正式版本。所有状态转换均校验版本、归属、归档与忙碌状态。
- [x] 执行后端测试与打包，验证协议请求包含历史和最新文档。

## 任务 2：对话与预览工作台

Files: `ai-assistant.tsx`, `workspace.tsx`, `ui.tsx`, `types.ts`, `projects/page.tsx`, `studio/[id]/page.tsx`, `globals.css`, `e2e/conversation.spec.ts`。

- [x] 先写浏览器验收：新建名称自动进入对话；两轮修改；关闭/刷新恢复；失败保留输入与草稿；保存更新正式版本；390px 布局。
- [x] 新建后携带 compose=1；现有 AI 编剧入口继续可用。左侧消息、右侧当前剧本；输入框持续可修改；等待状态不伪装流式；每次发送明确发起请求。
- [x] 结果由服务端持久化，不立即替换正式文档。满意保存后刷新工作台状态与历史；其他窗口更新时显示冲突和同步入口，不静默覆盖。
- [x] 运行 lint、typecheck、build 与浏览器验证；没有真实 Key 的测试使用协议替身，禁止把替身宣称为真实生成。

## 任务 3：发布与本机更新

Files: `README.md`, `docs/api.md`, `docs/verification.md`。

- [x] 文档说明对话草稿/正式版本、失败与租约恢复、最近 12 条上下文的限制和新增表的非破坏性初始化。
- [x] 检查提交不含 .env、数据库、日志和用户剧本；同步指定 GitHub 仓库；桌面独立目录快进更新并启动。
- [x] 验证已保存数据保留、界面可打开、核心交互通过；报告真实联调边界。
