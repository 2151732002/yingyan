import { test, expect } from "@playwright/test";

test("confirmed writing memory persists, suggestions require approval, and deletion revokes a requirement", async ({
  page,
}) => {
  await page.route("**/api/system", (route) =>
    route.fulfill({
      json: {
        stage: 1,
        aiConfigured: true,
        textModel: "memory-ui-test",
        videoGenerationAvailable: false,
      },
    }),
  );
  await page.goto("/login");
  await page.getByLabel("账号").fill("director");
  await page.getByLabel("密码", { exact: true }).fill("yingyan-demo-2026");
  await page.getByRole("button", { name: "进入创作空间" }).click();
  await expect(page.getByRole("heading", { name: "我的故事" })).toBeVisible();
  const project = await (
    await page.request.post("/api/projects", {
      data: {
        title: "记忆界面验收",
        logline: "",
        genre: "都市剧情",
        targetDuration: 45,
      },
    })
  ).json();
  await page.request.get(`/api/projects/${project.id}/conversation`);
  const seeded = await page.request.put(
    `/api/projects/${project.id}/conversation/memory`,
    {
      data: {
        expectedVersion: 1,
        expectedRevision: 1,
        requirements: ["始终保留林晚"],
        summary: "他们在雨夜的咖啡馆重逢。",
        suggestions: ["结局保持留白"],
      },
    },
  );
  expect(seeded.ok()).toBe(true);
  await page.goto(`/studio/${project.id}?compose=1`);
  await page.getByRole("button", { name: "创作记忆", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "创作记忆", exact: true });
  await expect(modal.getByLabel("长期要求 1", { exact: true })).toHaveValue(
    "始终保留林晚",
  );
  await expect(modal.getByLabel("故事摘要", { exact: true })).toHaveValue(
    /咖啡馆/,
  );
  await modal
    .getByRole("button", { name: "采纳建议：结局保持留白", exact: true })
    .click();
  await modal.getByLabel("新增长期要求", { exact: true }).fill("对白自然一点");
  await modal.getByRole("button", { name: "添加要求", exact: true }).click();
  await expect(modal.getByLabel("长期要求 3", { exact: true })).toHaveValue(
    "对白自然一点",
  );
  await modal
    .getByRole("button", { name: "保存创作记忆", exact: true })
    .click();
  await expect(modal).not.toBeVisible();
  const state = await (
    await page.request.get(`/api/projects/${project.id}/conversation`)
  ).json();
  expect(state.memory.requirements).toEqual([
    "始终保留林晚",
    "结局保持留白",
    "对白自然一点",
  ]);
  expect(state.memory.suggestions).toEqual([]);
  await page.reload();
  await page.getByRole("button", { name: "创作记忆", exact: true }).click();
  await expect(modal.getByLabel("长期要求 2", { exact: true })).toHaveValue(
    "结局保持留白",
  );
  await modal
    .getByRole("button", { name: "删除长期要求 2", exact: true })
    .click();
  await modal
    .getByRole("button", { name: "保存创作记忆", exact: true })
    .click();
  await page.getByRole("button", { name: "创作记忆", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await modal.locator("summary").filter({ hasText: "已撤销的要求" }).click();
  await expect(modal.getByText("结局保持留白", { exact: true })).toBeVisible();
  const box = await modal.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const saved = await (
    await page.request.get(`/api/projects/${project.id}`)
  ).json();
  expect(saved.revision).toBe(1);
  expect(saved.document.story).toBe("");
});
