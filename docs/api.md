# 第一阶段 API

接口由 Java 提供，前端通过 Next.js 同源代理调用 `/api`。除登录与 system 外均需 `yingyan_session` HttpOnly、SameSite=Lax 会话 Cookie。实际 HTTPS 部署应设置 `COOKIE_SECURE=true` 并配置允许的 Origin。会话有效期七天，退出立即失效；数据库只保存令牌哈希。

| 方法与路径（省略 /api） | 功能 |
| --- | --- |
| GET /system | 阶段、AI 是否配置、文本模型、视频功能不可用 |
| POST /auth/login | `{username,password}`，设置会话 Cookie |
| GET /auth/session | 当前账号 |
| POST /auth/logout | 撤销会话并清除 Cookie |
| GET /projects?archived=false | 当前用户项目，最多 100 条 |
| POST /projects | `{title,logline,genre,targetDuration}`，创建 V1 |
| GET /projects/{id} | 完整项目文档 |
| PUT /projects/{id} | 保存并创建新版本 |
| GET /projects/{id}/revisions | 最近 100 个不可变快照 |
| GET /projects/{id}/revisions/{n} | 指定历史快照 |
| POST /projects/{id}/restore | `{expectedRevision,sourceRevision}`，恢复为新版本 |
| POST /projects/{id}/archive | `{expectedRevision}`，归档并创建新版本 |
| POST /projects/{id}/unarchive | `{expectedRevision}`，启用并创建新版本 |
| GET /projects/{id}/assets | 私有参考图元数据 |
| POST /projects/{id}/assets | multipart `file`，真实 JPEG/PNG 最大 5MB |
| GET /assets/{id}/file | 当前用户有权读取的图片 |
| POST /projects/{id}/draft-suggestions | `{expectedRevision,prompt}`，返回 `{baseRevision,document,model}`，不保存 |
| GET /projects/{id}/conversation | 初始化/读取独立创作对话、当前工作草稿和版本状态 |
| POST /projects/{id}/conversation/turns | `{expectedVersion,expectedRevision,message}`，继续一轮讨论，持久化回复及完整工作草稿，不创建正式修订 |
| POST /projects/{id}/conversation/save | `{expectedVersion,expectedRevision}`，保存当前对话草稿为正式新版本，返回 `{project,conversation}` |
| POST /projects/{id}/conversation/rebase | `{expectedVersion,expectedRevision}`，以最新正式版本替换工作草稿，保留对话记录并追加说明 |
| PUT /projects/{id}/conversation/memory | `{expectedVersion,expectedRevision,requirements,summary,suggestions}`，显式保存长期创作要求与摘要，返回更新后的 conversation |

保存请求：

```json
{
  "expectedRevision": 1,
  "title": "雨夜咖啡馆",
  "logline": "一次告别",
  "genre": "都市剧情",
  "targetDuration": 45,
  "summary": "完善剧本",
  "document": {"story":"故事梗概","script":"文稿","characters":[],"scenes":[],"shots":[]}
}
```

结构字段与枚举见 `backend/src/main/java/com/yingyan/Models.java`。空文档可作为草稿保存；角色最多 2、场景最多 4、镜头最多 12，项目目标时长 10–60 秒。ID 必须唯一，引用必须存在；画内说话人必须在对应镜头出场，角色参考图必须属于当前项目。镜头时长是规划值，尚无真实媒体时长检查。

`expectedRevision` 过期返回 **409**，客户端保留草稿并提示下载/重新读取。保存、历史写入在同一事务中，条件更新成功才创建下一版本。恢复会复制历史内容为新版本，不修改原快照。归档项目不可编辑，重新启用后继续创作。

错误体：`{code,message}`。常见状态：400 参数或引用错误；401 未登录/密码错误；403 来源检查不通过；404 无权访问或不存在；409 版本冲突/归档状态；413 文件过大；503 AI 未配置；502/504 上游错误/超时。错误不向客户端返回上游响应或密钥。

AI 连接超时返回 `504 AI_CONNECT_TIMEOUT`，等待响应超时返回 `504 AI_RESPONSE_TIMEOUT`；JSON 解析失败返回 `502 AI_INVALID_OUTPUT`，其他网络失败返回 `502 AI_CONNECTION_ERROR`。连接超时意味着尚未得到上游 HTTP 响应，不能据此判断密钥、模型权限或余额。后端诊断只记录错误分类和异常类名，不记录原始异常消息、密钥、上游正文或用户剧本。填入配置只表示字段存在，不代表已验证模型可调用。

对话接口兼容模型的普通文字回复：以讨论消息保留，明确标注本轮草稿不变，不把自然语言猜成结构化修改；下一轮仍使用原工作草稿。所有 `output_text` 分段先合并再解析，忽略开头的 BOM 标记。结构化 JSON 损坏或截断时仍报错，不将它伪装成一次成功修改。解析诊断只记录阶段、内容形态、长度、行列、白名单字段名和 ASCII 字符码，不记录正文。请求附带显式 JSON 示例和完整 schema，没有自动再次调用付费模型。

上传单独保存，引用进入故事文档后随版本保存；未引用的上传仍保留，没有自动垃圾清理。素材 URL 必须经过会话鉴权，不能直接提供给需要公网 URL 的第三方视频模型。

对话结构：`{projectId,version,baseRevision,currentRevision,document,messages,processing,pendingPrompt,stale,hasChanges,updatedAt}`。消息为 `{id,role,content,createdAt}`。前端不提交可信历史或模型输出，Java 从自己的持久化记录读取上下文，每轮仅向模型发送最近 12 条消息及完整最新草稿。

对话响应额外包含 `memory: {requirements,summary,suggestions,revokedRequirements,updatedAt}`。初始为空列表和空摘要，updatedAt 为 null；存放在独立 `story_writing_memory` 表，启动时非破坏性创建。每轮实际上下文还包含全部长期要求、摘要与最近 40 条撤销要求，近期消息窗口仍为 12 条。

记忆写入沿用 conversation.version 乐观锁，expectedRevision 使用 currentRevision。写入在项目行锁内检查归属、归档、版本与生成租约，成功后推进对话 version，不更改正式剧本 revision、当前工作草稿或历史消息。生成中返回 409；其他账号访问返回 404。

用户要求最多 20 条、每条最多 300 字；摘要最多 4000 字；待确认建议最多 8 条。输入去除首尾空白并去重。删掉或改写的旧要求加入撤销列表，重新添加后移出。AI 的 `ChatReply.memory` 仅是 `{summary,suggestions}`，不能改写 requirements 或撤销列表；辅助记忆缺少必要字段或摘要超长时保留旧辅助记忆，有效剧本仍可完成保存。模型不能自行确认建议。正式剧本版本的保存、恢复及对话 rebase 不回退记忆，用户可在面板复核是否仍适用。

`version` 是独立的对话乐观锁，`baseRevision` 是工作草稿基于的正式剧本版本。发送与保存都必须匹配版本；正式剧本改变后返回 409，不覆盖它。生成使用 120 秒租约，模型调用在数据库事务外执行，完成时锁项目行再次检查正式版本。模型失败释放租约，保留先前消息/草稿及待重试要求；服务意外停止时，租约过期允许重新发送。没有承诺付费供应商请求 exactly-once，网络中断后重试仍可能产生额外调用。

保存通过同一事务创建正式修订并更新对话 baseRevision；没有新改动时拒绝重复保存。`rebase` 会替换工作草稿但不清除历史，前端在未保存草稿存在时要求用户确认。
