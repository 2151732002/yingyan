import { test, expect } from "@playwright/test";
import type { Conversation, Project } from "../lib/types";
import { sampleDocument } from "../lib/sample";

test("named story supports iterative chat, refresh, failure recovery and explicit save", async ({
  page,
}) => {
  const states = new Map<string, Conversation>();
  let failNext = false;
  await page.route("**/api/system", (route) =>
    route.fulfill({
      json: {
        stage: 1,
        aiConfigured: true,
        textModel: "protocol-test",
        videoGenerationAvailable: false,
      },
    }),
  );
  await page.route(
    /\/api\/projects\/[^/]+\/conversation(?:\/.*)?$/,
    async (route) => {
      const url = new URL(route.request().url());
      const id = url.pathname.split("/")[3];
      const project = (await (
        await page.request.get(`/api/projects/${id}`)
      ).json()) as Project;
      let state = states.get(id);
      if (!state) {
        state = {
          projectId: id,
          version: 1,
          baseRevision: project.revision,
          currentRevision: project.revision,
          document: project.document,
          messages: [],
          processing: false,
          pendingPrompt: "",
          stale: false,
          hasChanges: false,
          updatedAt: new Date().toISOString(),
        };
        states.set(id, state);
      }
      if (url.pathname.endsWith("/turns")) {
        if (failNext) {
          failNext = false;
          await route.fulfill({
            status: 504,
            json: {
              code: "AI_CONNECT_TIMEOUT",
              message: "测试连接超时，请保留输入后重试。",
            },
          });
          return;
        }
        const body = route.request().postDataJSON();
        const draft = sampleDocument();
        draft.story = state.messages.length
          ? "雨夜重逢，结局留白，两人没有说破。"
          : "雨夜重逢的第一版故事。";
        state = {
          ...state,
          version: state.version + 1,
          document: draft,
          hasChanges: true,
          messages: [
            ...state.messages,
            {
              id: crypto.randomUUID(),
              role: "user",
              content: body.message,
              createdAt: new Date().toISOString(),
            },
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: state.messages.length
                ? "已保留人物，并把结局改为留白。"
                : "先写了一版重逢故事，我们可以继续调整。",
              createdAt: new Date().toISOString(),
            },
          ],
        };
      } else if (url.pathname.endsWith("/save")) {
        const saved = await page.request.put(`/api/projects/${id}`, {
          data: {
            ...project,
            expectedRevision: project.revision,
            document: state.document,
            summary: "保存对话创作剧本",
          },
        });
        expect(saved.ok()).toBe(true);
        const p = (await saved.json()) as Project;
        state = {
          ...state,
          version: state.version + 1,
          baseRevision: p.revision,
          currentRevision: p.revision,
          hasChanges: false,
        };
        states.set(id, state);
        await route.fulfill({ json: { project: p, conversation: state } });
        return;
      }
      states.set(id, state);
      await route.fulfill({ json: state });
    },
  );
  await page.goto("/login");
  await page.getByLabel("账号").fill("director");
  await page.getByLabel("密码", { exact: true }).fill("yingyan-demo-2026");
  await page.getByRole("button", { name: "进入创作空间" }).click();
  await page.getByRole("button", { name: "新建故事", exact: true }).click();
  await page.getByLabel("故事名称").fill("对话剧本验收");
  await page.getByRole("button", { name: "创建项目", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "对话创作 · 对话剧本验收" }),
  ).toBeVisible();
  const id = new URL(page.url()).pathname.split("/")[2];
  await page.getByLabel("和 AI 讨论剧本").fill("写一场雨夜重逢。");
  await page.getByRole("button", { name: "发送消息", exact: true }).click();
  await expect(page.getByTestId("conversation-story")).toContainText("第一版");
  expect(
    (await (await page.request.get(`/api/projects/${id}`)).json()).document
      .story,
  ).toBe("");
  await page.getByLabel("和 AI 讨论剧本").fill("保留人物，把结局改成留白。");
  await page.getByRole("button", { name: "发送消息", exact: true }).click();
  await expect(page.getByTestId("conversation-story")).toContainText(
    "结局留白",
  );
  await expect(page.locator(".conversation-message.assistant")).toHaveCount(2);
  await page.reload();
  await expect(page.getByTestId("conversation-story")).toContainText(
    "结局留白",
  );
  await expect(page.locator(".conversation-message.assistant")).toHaveCount(2);
  failNext = true;
  await page.getByLabel("和 AI 讨论剧本").fill("让对白再自然一点。");
  await page.getByRole("button", { name: "发送消息", exact: true }).click();
  await expect(
    page.getByText("测试连接超时，请保留输入后重试。", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("和 AI 讨论剧本")).toHaveValue(
    "让对白再自然一点。",
  );
  await expect(page.getByTestId("conversation-story")).toContainText(
    "结局留白",
  );
  await page.getByRole("button", { name: "发送消息", exact: true }).click();
  await expect(page.locator(".conversation-message.assistant")).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "满意，保存剧本", exact: true })
    .click();
  await expect(page.getByText(/已保存为 V2/)).toBeVisible();
  await page.getByRole("button", { name: "关闭对话框" }).click();
  await expect(page.getByLabel("故事梗概")).toHaveValue(/结局留白/);
  await page.getByRole("button", { name: "AI 编剧", exact: true }).click();
  await expect(page.locator(".conversation-message.assistant")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "满意，保存剧本", exact: true }),
  ).toBeDisabled();
});
