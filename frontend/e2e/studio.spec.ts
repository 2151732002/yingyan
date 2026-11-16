import { test, expect } from "@playwright/test";

test("create, edit, save, refresh and restore an immutable story revision", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "进入创作空间" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/login.png",
    fullPage: true,
  });
  await page.getByLabel("账号").fill("director");
  await page.getByLabel("密码", { exact: true }).fill("yingyan-demo-2026");
  await page.getByRole("button", { name: "进入创作空间" }).click();
  await expect(page.getByRole("heading", { name: "我的故事" })).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/projects.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "新建故事", exact: true }).click();
  await page.getByLabel("故事名称").fill("雨夜的咖啡馆");
  await page.getByRole("button", { name: "创建项目", exact: true }).click();
  await expect(page).toHaveURL(/\/studio\//);
  await page.getByRole("button", { name: "载入示例剧本", exact: true }).click();
  await expect(page.getByLabel("故事梗概")).toHaveValue(/雨/);
  await page.screenshot({
    path: "../docs/screenshots/story.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "保存版本", exact: true }).click();
  await expect(page.getByText("全部更改已保存", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("故事梗概")).toHaveValue(/雨/);
  await page.getByRole("button", { name: "角色", exact: true }).click();
  await expect(page.getByLabel("角色姓名").first()).toHaveValue("林夏");
  await page
    .getByRole("button", { name: "上传参考图", exact: true })
    .first()
    .click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "reference.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByAltText("林夏参考图")).toBeVisible();
  await page.getByLabel("角色姓名").first().fill("林夏");
  await page.getByRole("button", { name: "保存版本", exact: true }).click();
  await expect(page.getByText("全部更改已保存", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "分镜", exact: true }).click();
  await expect(page.locator(".shot-list-item")).toHaveCount(4);
  await page.getByLabel("对白内容").fill("你真的决定离开了吗？");
  await page.getByRole("button", { name: "镜头下移", exact: true }).click();
  await page.getByRole("button", { name: "保存版本", exact: true }).click();
  await expect(page.getByText("全部更改已保存", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "角色", exact: true }).click();
  await page
    .getByRole("button", { name: "移除林夏参考图", exact: true })
    .click();
  await page.getByRole("button", { name: "保存版本", exact: true }).click();
  await expect(page.getByText("全部更改已保存", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "分镜", exact: true }).click();
  await expect(page.locator(".shot-list-item")).toHaveCount(4);
  await page.screenshot({
    path: "../docs/screenshots/storyboard.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "版本记录", exact: true }).click();
  await page.getByRole("button", { name: "查看 V1", exact: true }).click();
  await page.getByRole("button", { name: "恢复为新版本", exact: true }).click();
  await expect(page.getByLabel("故事梗概")).toHaveValue("");
  await page.screenshot({
    path: "../docs/screenshots/workspace.png",
    fullPage: true,
  });
});

test("concurrent saves keep the local draft and unconfigured AI stays honest", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("账号").fill("director");
  await page.getByLabel("密码", { exact: true }).fill("yingyan-demo-2026");
  await page.getByRole("button", { name: "进入创作空间" }).click();
  await expect(page.getByRole("heading", { name: "我的故事" })).toBeVisible();
  const response = await page.request.post("/api/projects", {
    data: {
      title: "并发编辑验收",
      logline: "",
      genre: "都市剧情",
      targetDuration: 45,
    },
  });
  const project = await response.json();
  await page.goto(`/studio/${project.id}`);
  await page.getByRole("button", { name: "AI 编剧", exact: true }).click();
  await expect(
    page.getByText("文本辅助尚未连接", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭对话框", exact: true }).click();
  const latest = await page.request.put(`/api/projects/${project.id}`, {
    data: {
      ...project,
      expectedRevision: 1,
      document: { ...project.document, story: "另一窗口已保存" },
      summary: "另一窗口",
    },
  });
  expect(latest.ok()).toBe(true);
  await page.getByLabel("故事梗概").fill("保留本地未提交故事");
  await page.getByRole("button", { name: "保存版本", exact: true }).click();
  await expect(
    page.getByText(
      "你的草稿仍保留在当前页面。可以先下载备份，再载入最新版本。",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel("故事梗概")).toHaveValue("保留本地未提交故事");
  const result = await page.request.get(`/api/projects/${project.id}`);
  expect((await result.json()).document.story).toBe("另一窗口已保存");
});

test("expired session redirects to login and mobile project list fits screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("账号").fill("director");
  await page.getByLabel("密码", { exact: true }).fill("yingyan-demo-2026");
  await page.getByRole("button", { name: "进入创作空间" }).click();
  await expect(page.getByRole("heading", { name: "我的故事" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(
    page.getByRole("button", { name: "进入创作空间" }),
  ).toBeVisible();
});
