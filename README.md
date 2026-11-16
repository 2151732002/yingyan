# 映言 · Yingyan

让故事中的人，开口说话。

面向中文写实剧情短片的创作工作台。这个独立仓库交付**第一阶段：故事到可编辑分镜**，为后续角色配音、口型视频和成片制作打基础。当前没有视频生成、配音生成、支付或计费功能。

代码仓库：[2151732002/yingyan](https://github.com/2151732002/yingyan)。后续版本继续提交到此仓库。

![分镜工作台](docs/screenshots/storyboard.png)

## 已实现

- 账号登录、服务端会话、退出登录、按账号隔离项目和素材。
- 创建、搜索、归档与重新启用故事项目。
- 编辑故事梗概、剧本文稿、场景光线和人物站位。
- 两位主要角色：身份、外貌、服装、声音设定、JPEG/PNG 参考图上传。
- 最多 12 个分镜：镜头排序、景别、出场角色、对白归属、情绪、语速、画内对白/画外音。声音字段目前是创作设定，不会播放或生成音频。
- 手动保存版本、刷新后恢复、查看不可变历史、恢复旧版为新版本、并发冲突提示与 JSON 草稿导出。
- 可选 OpenAI 文本辅助：生成结构化剧本建议，先预览、再采用、再手动保存。未配置密钥时可完整手工创作。
- 桌面和手机适配；提供“雨夜咖啡馆”示例，示例人物与画面占位不代表生成结果。

## 本地启动（Windows）

依赖：Java 21、Maven 3.9+、Node.js 24、npm。演示模式使用 H2 文件数据库，不需要 MySQL、Docker 或 AI 密钥。

在仓库根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-demo.ps1
```

打开 **http://127.0.0.1:3100**。未配置 `.env` 时，演示账号为 `director`，密码为 `yingyan-demo-2026`。脚本首次安装前端依赖并构建；已经安装依赖时可以传 `-SkipInstall`。若当前环境不能访问 Maven/npm 仓库，需要先配置可用的依赖源。

停止本次启动的进程：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/stop-demo.ps1
```

数据保留在 `backend/data/`，进程记录和日志在 `.local/`，均不提交到 Git。后端监听 18080，前端监听 3100，不占用原项目的 8080/3000。

也可以分别启动开发服务：

```powershell
# 终端一，仓库根目录
mvn -f backend/pom.xml spring-boot:run "-Dspring-boot.run.profiles=demo"
# 终端二
cd frontend
npm ci
npm run dev
```

## 密钥与账号配置

如需修改初始账号或启用 AI，在**仓库根目录**将 `.env.example` 复制为 `.env`。Spring Boot 从后端目录启动时读取根目录文件，环境变量优先。无需把密钥放进前端。

```dotenv
YINGYAN_ADMIN_USERNAME=director
YINGYAN_ADMIN_PASSWORD=your-long-local-password
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1
```

只在自己的 `.env` 中填入真实 Key，不要发到聊天中、提交 Git、放进截图或使用 `NEXT_PUBLIC_*`。模板里的账号密码只是本地示例，启用前请修改。初始密码至少 12 个字符；账号只在数据库中不存在时创建，修改环境变量不会重置已有账号密码。

当前仅实现 OpenAI Responses 文本适配器，使用严格 JSON Schema、服务端校验和 60 秒超时。配置其他 Base URL 不代表其他厂商协议已经兼容。当前 AI 建议请求同步执行，失败可重试；没有承诺跨进程恢复的后台生成任务。

**现在需要额外开通服务吗？** 第一阶段不需要。已有 OpenAI API 额度可用于文本辅助，但仍以账号的模型权限、额度和服务地区为准；额度不能支付其他厂商的调用。尚未使用真实用户 Key 验证线上生成。

面向国内用户上线时，需要选择在部署地区可用的服务；[OpenAI 官方支持地区](https://developers.openai.com/api/docs/supported-countries)当前不包含中国大陆。后续真实视频阶段再确认并开通对应的视频/口型模型、语音服务和对象存储。本阶段无需提前开通所有供应商。

## MySQL 与 Docker

默认后端配置使用 MySQL；`demo` profile 才切换为 H2。创建数据库和业务账号后，从 `backend` 目录启动：

```powershell
$env:DB_URL='jdbc:mysql://127.0.0.1:3306/yingyan?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai'
$env:DB_USER='yingyan'
$env:DB_PASSWORD='your-database-password'
$env:YINGYAN_ADMIN_PASSWORD='your-long-local-password'
mvn spring-boot:run
```

表结构位于 `backend/src/main/resources/schema.sql`，启动时执行 `CREATE TABLE IF NOT EXISTS`。后续存在结构变更时应引入正式迁移；当前没有生产升级迁移方案。

安装 Docker 后，也可配置根目录 `.env` 的 `DB_PASSWORD`、`MYSQL_ROOT_PASSWORD`、`YINGYAN_ADMIN_PASSWORD`，执行：

```sh
docker compose up --build -d
docker compose down
```

Compose 提供 MySQL 8.4、Java 后端和 Next.js 前端，地址仍为 http://127.0.0.1:3100。数据库和参考图分别使用持久卷。当前环境未运行 Docker，不能将此部署文件视为已完成容器部署验收。不要使用 `down -v` 清理需要保留的数据。

## 技术与目录

Next.js 16.4.3 App Router、React 19.3.1、TypeScript、TanStack Query；Java 21、Spring Boot 3.5.13、MyBatis 3.0.5；MySQL / H2 演示数据库。具体锁定版本见 `frontend/package-lock.json` 和 `backend/pom.xml`。

```text
frontend/                 中文创作工作台、同源 API 代理、浏览器测试
backend/                  Java 业务接口、持久化、私有素材、AI 文本适配器
docs/design.md            已确认的完整产品设计与阶段边界
docs/api.md               第一阶段接口和版本语义
docs/verification.md      实际验证记录与限制
scripts/                  Windows 演示启动与停止
compose.yaml              可选 MySQL 容器部署配置
.github/workflows/ci.yml   后端、前端和浏览器自动检查
```

Next.js 将 `/api/*` 代理到 Java，业务与持久化由 Java 承担。素材真实解码校验，最大 5MB、2000 万像素，使用随机存储名，并通过登录权限接口读取。历史快照包含项目元数据和文档，恢复生成新修订，不覆盖历史；角色、场景、镜头和台词通过稳定 ID 关联。

## 验证

```powershell
mvn -B -f backend/pom.xml verify
cd frontend
npm ci
npm run lint
npm test
npm run typecheck
npm run build
# 自动启动已打包后端与已构建前端；本机需安装 Edge
$env:CI='true'
npm run test:e2e
```

Linux CI 使用 Playwright Chromium（先执行 `npx playwright install --with-deps chromium`，设置 `E2E_CHANNEL=chromium`）。浏览器测试启动前必须已生成后端 JAR 和前端生产构建。测试使用独立浏览器会话；演示数据库中会保留测试项目。

后端行为测试默认 H2；也可使用专用空测试数据库设置 `TEST_DB_URL`、`TEST_DB_USER`、`TEST_DB_PASSWORD`、`TEST_DB_DRIVER=com.mysql.cj.jdbc.Driver`。不要指向生产数据库。AI 协议测试使用本地 HTTP 替身，不消耗真实额度。

## 下一阶段

先完成 10–15 秒双人对白样片：明确角色参考、声音归属和正反打镜头，接入真实语音与单人说话口型视频，再做 FFmpeg 成片合成与局部重做。持久任务状态、失败恢复、供应商回调/轮询、资源审计和对象存储属于该阶段。

第一阶段只有管理员初始化账号，没有公开注册、找回密码、登录限流、内容审核或生产运维体系；当前交付用于本地验证和继续开发，不代表可直接公开运营。
