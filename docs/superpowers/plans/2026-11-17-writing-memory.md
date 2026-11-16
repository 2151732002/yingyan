# 剧本长期记忆实施计划

**Goal:** 长对话中持续保留已确认创作要求，滚动整理故事摘要，允许用户查看、修正、删除记忆。

**Architecture:** 每个剧本新增独立 `story_writing_memory` 记录；不修改旧表、不跨项目共享。已确认要求只能由用户保存；AI 在原有生成请求中附带摘要和待确认建议，不增加后台付费调用。每轮发送完整已确认要求、已撤销要求、滚动摘要、当前草稿及最近 12 条消息。

**Scope:** 用户已同意实现上一轮提出的长期创作要求记忆。沿用现有样式与密钥配置。摘要是参考，当前用户要求及已确认记忆优先；模型输出不能自行增删已确认要求。

## 任务 1：持久化与模型协议

Files: `Models.java`, `WritingMemoryMapper.java`, `WritingMemoryService.java`, `ConversationService.java`, `ConversationMapper.java`, `ConversationController.java`, `AiPlanner.java`, `schema.sql`, `ConversationTest.java`, `AiPlannerTest.java`。

- [x] 写失败测试：记忆更新/刷新保留、随下一轮请求传递、模型只更新摘要和建议、删除后撤销、旧版本/忙碌/其他账号拒绝、失败保留记忆。
- [x] 定义 `WritingMemory(requirements,summary,suggestions,revokedRequirements,updatedAt)` 与 `MemoryProposal(summary,suggestions)`；`ChatReply` 增加可空 memory，兼容旧的二参数构造和普通文字回复。
- [x] 新建表保存 JSON 列表及摘要；`PUT /projects/{id}/conversation/memory` 在项目锁下检查对话版本与租约、更新记忆并推进对话 version，不创建剧本修订。
- [x] 模型输出只替换合规的参考摘要/待确认建议；已确认要求与撤销列表只能由用户编辑。辅助记忆格式异常时保留旧记忆，不丢弃有效剧本。
- [x] AI 请求始终携带全部长期要求和摘要，即使某条原始消息已超出最近 12 条；模型撤销要求优先于旧摘要。新增协议测试确认这一点。
- [x] 运行 H2 与 MySQL 行为测试和打包。

## 任务 2：可控的记忆面板

Files: `writing-memory.tsx`, `ai-assistant.tsx`, `types.ts`, `globals.css`, `e2e/memory.spec.ts`。

- [x] 浏览器验收：打开创作记忆、添加要求保存、重新打开/刷新保留、采纳建议后显式保存、删除要求、手机布局。
- [x] 对话工具栏增加“创作记忆”；面板展示已确认要求、故事摘要、AI 待确认建议、已撤销要求。支持编辑/删除/重新添加，明确显示草稿状态。
- [x] 保存采用打开面板时的 expectedVersion，冲突保留本地编辑；模型生成中禁止改记忆。
- [x] 运行 lint、单元测试、typecheck、build 和核心浏览器流程，使用独立 QA 数据和协议替身，不重放用户剧本。

## 任务 3：交付

- [x] README/API/验证记录说明作用范围、首轮摘要建立方式、模型可遗忘限制和无额外模型请求。
- [x] 检查无密钥/用户内容提交后推送指定 GitHub 仓库。
- [x] 独立桌面项目更新，验证原有剧本/对话保留；启动服务并检查实际记忆面板可访问。
