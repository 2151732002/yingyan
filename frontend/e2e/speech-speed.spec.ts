import { test, expect } from "@playwright/test";
import { sampleDocument } from "../lib/sample";

test("custom AI speeds display correctly and can be normalized without generating audio", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("账号").fill("director");
  await page.getByLabel("密码", { exact: true }).fill("yingyan-demo-2026");
  await page.getByRole("button", { name: "进入创作空间" }).click();
  await expect(page.getByRole("heading", { name: "我的故事" })).toBeVisible();
  const p = await (
    await page.request.post("/api/projects", {
      data: {
        title: "自定义语速回归",
        logline: "",
        genre: "剧情",
        targetDuration: 45,
      },
    })
  ).json();
  const document = sampleDocument();
  document.shots = document.shots.filter((s) => s.dialogue);
  document.shots[0].dialogue!.speed = 0.85;
  document.shots[1].dialogue!.speed = 0.9;
  document.shots.push({
    ...structuredClone(document.shots[0]),
    id: "blank-shot",
    dialogue: {
      ...document.shots[0].dialogue!,
      id: "blank-line",
      text: "",
      speed: 0.7,
    },
  });
  const saved = await page.request.put(`/api/projects/${p.id}`, {
    data: { ...p, expectedRevision: 1, document, summary: "准备虚构语速用例" },
  });
  expect(saved.ok()).toBe(true);
  let generations = 0;
  await page.route(`**/api/projects/${p.id}/speech`, (route) =>
    route.fulfill({
      json: {
        configured: true,
        provider: "UI fixture",
        voices: [
          { id: "stella", name: "Stella · 女声" },
          { id: "tide", name: "Tide · 男声" },
        ],
        bindings: document.characters.map((c) => ({
          characterId: c.id,
          voiceId: "stella",
          version: 1,
        })),
        jobs: [],
      },
    }),
  );
  await page.route(`**/api/projects/${p.id}/speech/jobs`, (route) => {
    generations++;
    return route.fulfill({
      status: 500,
      json: { message: "This test must not generate audio" },
    });
  });
  await page.goto(`/studio/${p.id}`);
  await page.getByRole("button", { name: "分镜", exact: true }).click();
  await expect(page.getByRole("combobox", { name: /^期望语速/ })).toHaveValue(
    "0.85",
  );
  await expect(
    page.getByRole("combobox", { name: /^期望语速/ }).locator("option:checked"),
  ).toHaveText("自定义 · 0.85");
  await page.getByRole("button", { name: "配音", exact: true }).click();
  const buttons = page.getByRole("button", { name: "生成这句", exact: true });
  await expect(buttons).toHaveCount(2);
  await expect(buttons.nth(0)).toBeDisabled();
  await page
    .getByRole("button", { name: "统一为原速并保存", exact: true })
    .click();
  await expect(buttons.nth(0)).toBeEnabled();
  await expect(buttons.nth(1)).toBeEnabled();
  const next = await (await page.request.get(`/api/projects/${p.id}`)).json();
  expect(next.revision).toBe(3);
  const expected = structuredClone(document);
  expected.shots[0].dialogue!.speed = 1;
  expected.shots[1].dialogue!.speed = 1;
  expect(next.document).toEqual(expected);
  const previous = await (
    await page.request.get(`/api/projects/${p.id}/revisions/2`)
  ).json();
  expect(previous.document).toEqual(document);
  expect(generations).toBe(0);
  await page.reload();
  await page.getByRole("button", { name: "配音", exact: true }).click();
  await expect(buttons.nth(0)).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "统一为原速并保存", exact: true }),
  ).toHaveCount(0);
});
