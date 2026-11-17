# 角色配音

## 使用

1. 完成角色和分镜对白，并保存项目版本。
2. 打开「配音」，为每个角色选择 Stella 女声或 Tide 男声，点击「保存音色」。角色原有声音描述不受影响，音色选择独立保存，不创建剧本修订。
3. 可点击「音色试听」生成固定示例句；每次点击会调用一次服务。
4. 点击每句对白的「生成这句」。可离开页面，回来查看排队、生成中、成功或失败状态。
5. 单句试听或重做；所有对白有当前有效音频后可「顺序试听」，选择句间停顿。连听属于浏览器试听，不生成合并文件。
6. 修改对白、归属角色、情绪备注、语速或实际音色后，旧音频标记过期但保留。只需重新生成变更的台词。

## 配置

如果后端 `OPENAI_BASE_URL` 使用 `https://api.deepseek.com`（可带 `/v1`），会复用后端 `OPENAI_API_KEY`。OpenAI 或其他兼容服务的 Key 不会自动发送给 DeepSeek。

需要单独配置时，在根目录私有 `.env` 加入：

```properties
SPEECH_API_KEY=你的DeepSeek密钥
SPEECH_BASE_URL=https://api.deepseek.com
```

重启服务即可。不在网页输入或暴露密钥。没有配置时可以手工创作及保存音色，但不能生成或试听真实声音。平台没有接入计费模块，语音提供商仍按自身规则收取 API 用量费用。

## 已知能力边界

按 [DeepSeek 官方文档](https://api-docs.deepseek.com/guides/tts/)（2026-11-17），当前只有 Stella/Tide 两种音色；接口没有语速和情绪控制。因此本版要求分镜语速为 1.0，情绪只保留为创作备注，不宣称合成执行了该情绪。不支持克隆声音、精细表演指导、口型或视频。

## 任务及安全

- Java 在事务中锁定项目，校验正式版本和音色版本后写入队列。只使用已保存对白，不发送浏览器临时草稿。
- 配音记录不可覆盖，包含项目修订、角色、台词、音色、表演参数指纹和生成文件。单个镜头只能有一个待处理任务；项目最多 12 个排队/执行任务。
- 当前后台串行执行（每秒检查队列）。数据库条件更新领取任务，领取令牌保护最终写入，多个实例也不能领取同一记录。
- QUEUED 任务重启后继续；RUNNING 任务租约 3 分钟，过期标记失败，不自动再次调用服务。服务调用最多等待 95 秒，不做自动重试，手动重做产生新记录。
- 服务端通过 WebSocket 接收 24 kHz 单声道 PCM16，必须收到 `finish/success` 才封装为完整 WAV；连接中断或失败事件即使已收到部分音频也不会发布。限制最大时长 180 秒，封装后校验 RIFF 和音频块长度。前端仍使用普通 HTTP 轮询，不需要 WebSocket 连接。
- 音频存放在 `STORAGE_DIR/speech`，默认 `backend/data/assets/speech`；文件接口校验登录、任务归属与项目归属。无公共静态音频目录，支持 HTTP Range 试听。
- 页面展示最近 200 条任务；数据库与文件保留更早记录，本版没有清理/删除界面。旧版本不自动成为最新台词的结果。
- 运行数据、密钥、音频及日志不提交 Git。备份时同时备份数据库和 `STORAGE_DIR`。

## API

所有接口需要同源登录 Cookie。

| 方法 | 路径 | 请求 / 语义 |
| --- | --- | --- |
| GET | `/api/projects/{id}/speech` | 配置状态、音色列表、绑定版本、最近 200 条任务；任务含 stale、私有音频 URL |
| PUT | `/api/projects/{id}/speech/voices/{characterId}` | `{expectedRevision,expectedVersion,voiceId}`；首次绑定版本为 0，成功后版本 +1 |
| POST | `/api/projects/{id}/speech/jobs` | `{expectedRevision,expectedVoiceVersion,shotId}`；202 返回 QUEUED 输入快照 |
| POST | `/api/projects/{id}/speech/previews` | `{expectedRevision,voiceId}`；202 固定示例句，不发送用户故事 |
| GET | `/api/speech/jobs/{jobId}/file` | 成功后的私有 WAV，可 Range；未就绪 409，其他账号 404 |

任务状态：`QUEUED → RUNNING → SUCCEEDED / FAILED`。历史任务状态可查询，即使其对白已修改或角色已删除。

写入版本过期、音色冲突和重复任务返回 409；服务未配置返回 503；归档项目不能新增生成。上游认证、限流、超时、连接和音频格式错误写入失败记录，不返回上游原文或密钥。
