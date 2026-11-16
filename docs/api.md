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

上传单独保存，引用进入故事文档后随版本保存；未引用的上传仍保留，没有自动垃圾清理。素材 URL 必须经过会话鉴权，不能直接提供给需要公网 URL 的第三方视频模型。
