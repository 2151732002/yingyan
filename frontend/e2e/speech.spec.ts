import { test, expect } from "@playwright/test";
import { sampleDocument } from "../lib/sample";

test("speech workspace binds voices, keeps per-line history, and warns about stale audio", async ({
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
        title: "配音界面验收",
        logline: "",
        genre: "剧情",
        targetDuration: 45,
      },
    })
  ).json();
  const story = sampleDocument();
  story.shots.forEach((s) => {
    if (s.dialogue) s.dialogue.speed = 1;
  });
  await page.request.put(`/api/projects/${p.id}`, {
    data: { ...p, expectedRevision: 1, document: story, summary: "虚构示例" },
  });
  const state = {
    configured: true,
    provider: "UI protocol fixture",
    voices: [
      { id: "stella", name: "Stella · 女声", description: "" },
      { id: "tide", name: "Tide · 男声", description: "" },
    ],
    bindings: [] as { characterId: string; voiceId: string; version: number }[],
    jobs: [] as Record<string, unknown>[],
  };
  await page.route(`**/api/projects/${p.id}/speech**`, async (route) => {
    const req = route.request();
    if (req.method() === "GET") return route.fulfill({ json: state });
    const body = req.postDataJSON();
    if (req.method() === "PUT") {
      const characterId = req.url().split("/").at(-1)!;
      const binding = {
        characterId,
        voiceId: body.voiceId,
        version: body.expectedVersion + 1,
      };
      state.bindings = [
        ...state.bindings.filter((b) => b.characterId !== characterId),
        binding,
      ];
      return route.fulfill({ json: binding });
    }
    const shot = story.shots.find((s) => s.id === body.shotId)!;
    const job = {
      id: `fixture-${state.jobs.length}`,
      shotId: shot.id,
      dialogueId: shot.dialogue!.id,
      characterId: shot.dialogue!.speakerId,
      characterName: "林夏",
      text: shot.dialogue!.text,
      emotion: "",
      speed: 1,
      voiceId: "stella",
      projectRevision: 2,
      status: "QUEUED",
      errorMessage: "",
      durationSeconds: 0,
      stale: false,
      url: "",
      createdAt: new Date().toISOString(),
    };
    state.jobs.unshift(job);
    return route.fulfill({ status: 202, json: job });
  });
  await page.goto(`/studio/${p.id}`);
  await page.getByRole("button", { name: "配音", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "让角色，拥有自己的声音。" }),
  ).toBeVisible();
  const first = story.characters[0];
  await page.getByLabel(`${first.name}的配音音色`).selectOption("stella");
  await page.getByRole("button", { name: `保存${first.name}的音色` }).click();
  await expect(page.getByText("音色已保存").first()).toBeVisible();
  const shot = story.shots.find((s) => s.dialogue?.speakerId === first.id)!;
  const line = page.getByTestId(`speech-${shot.id}`);
  await line.getByRole("button", { name: "生成这句" }).click();
  await expect(line.getByRole("button", { name: "排队中" })).toBeDisabled();
  state.jobs[0] = {
    ...state.jobs[0],
    status: "SUCCEEDED",
    durationSeconds: 2.1,
    url: "/fixture.wav",
    stale: true,
  };
  await page.getByRole("button", { name: "刷新配音状态" }).click();
  await expect(line.getByText("已过期", { exact: true })).toBeVisible();
  await line.getByRole("button", { name: "重新生成这句" }).click();
  state.jobs[0] = {
    ...state.jobs[0],
    status: "FAILED",
    errorMessage: "语音服务繁忙，请稍后手动重试",
  };
  await page.getByRole("button", { name: "刷新配音状态" }).click();
  await expect(line.getByText("语音服务繁忙，请稍后手动重试")).toBeVisible();
  await line.getByRole("button", { name: "历史配音（2）" }).click();
  await expect(line.locator("audio")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "配音", exact: true }).click();
  await expect(page.getByLabel(`${first.name}的配音音色`)).toHaveValue(
    "stella",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "让角色，拥有自己的声音。" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../docs/screenshots/speech-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "../docs/screenshots/speech-desktop.png",
    fullPage: true,
  });
  // Browser playback uses an explicit sine/silence fixture, never a real provider.
  const wav = Buffer.alloc(44 + 96000);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24);
  wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(96000, 40);
  await page.route("**/fixture.wav", (route) =>
    route.fulfill({ contentType: "audio/wav", body: wav }),
  );
  state.bindings = story.characters.map((c) => ({
    characterId: c.id,
    voiceId: "stella",
    version: 1,
  }));
  state.jobs = story.shots
    .filter((s) => s.dialogue)
    .map((s) => ({
      ...state.jobs[0],
      id: s.id,
      shotId: s.id,
      characterId: s.dialogue!.speakerId,
      status: "SUCCEEDED",
      stale: false,
      url: "/fixture.wav",
      durationSeconds: 2,
    }));
  await page.getByRole("button", { name: "刷新配音状态" }).click();
  await page.getByRole("button", { name: "顺序试听", exact: true }).click();
  const audio = await page.locator(".speech-sequence audio").elementHandle();
  await expect
    .poll(() => audio!.evaluate((el) => (el as HTMLAudioElement).currentTime))
    .toBeGreaterThan(0.1);
  await page.getByRole("button", { name: "剧本", exact: true }).click();
  await expect
    .poll(() => audio!.evaluate((el) => (el as HTMLAudioElement).paused), {
      timeout: 700,
    })
    .toBe(true);
  await page.getByRole("button", { name: "配音", exact: true }).click();
  await page.getByRole("button", { name: "顺序试听", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "停止连听", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "顺序试听", exact: true }),
  ).toBeVisible({ timeout: 12000 });
});
