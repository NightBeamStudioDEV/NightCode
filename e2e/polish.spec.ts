import { test, expect, chromium } from "@playwright/test";
import { preview } from "vite";

test("polished surfaces: activity grouping, reasoning colors, scroll stability and compact windows", async () => {
  const server = await preview({
    preview: { host: "127.0.0.1", port: 5189, strictPort: true },
  });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    await page.addInitScript(() => {
      const model = {
        id: "model-one",
        name: "Muse Spark",
        variants: ["minimal", "low", "medium", "high", "xhigh"],
      };
      const snapshot = {
        projects: [
          { id: "project", name: "NightCode", path: "E:\\Projects\\NightCode" },
        ],
        sessions: [
          {
            id: "chat",
            title: "Polish the workspace",
            projectId: "project",
            updated: 1,
          },
        ],
        providers: [
          {
            id: "provider",
            name: "OpenCode Go",
            model: model.id,
            connected: true,
          },
        ],
        approvals: [],
        commands: [],
        drafts: {},
        engine: "Ready",
        activeSessionId: "chat",
        preferences: {
          sidebar: true,
          providerId: "provider",
          modelId: model.id,
          projectId: "project",
        },
      };
      let messages: any[] = [
        {
          info: { id: "u", role: "user" },
          parts: [
            {
              type: "text",
              text: "Polish the workspace and check the responsive layout.",
            },
          ],
        },
        {
          info: { id: "a", role: "assistant" },
          parts: [
            {
              type: "text",
              text: "I’ll update the workspace, tighten the activity feed, and check the model controls at smaller window sizes.",
            },
          ],
        },
        ...Array.from({ length: 6 }, (_, i) => ({
          info: { id: `tool-${i}`, role: "assistant" },
          parts: [
            { type: "step-start" },
            {
              type: "tool",
              tool: i < 3 ? "nightcode_propose_edit" : "nightcode_read_file",
              state: {
                status: i === 5 ? "running" : "completed",
                input: {
                  path: `src/${["main.tsx", "style.css", "activity.ts", "shared.ts", "components/Conversation.tsx", "polish.css"][i]}`,
                },
                output: i === 5 ? undefined : "File updated and verified.",
              },
            },
          ],
        })),
      ];
      let callback = (_event: any) => {};
      (window as any).__push = (text: string) => {
        messages.push({
          info: { id: `extra-${messages.length}`, role: "assistant" },
          parts: [{ type: "text", text }],
        });
        callback({ type: "messages" });
      };
      (window as any).nightcode = {
        invoke: async (action: string) => {
          if (action === "snapshot") return snapshot;
          if (action === "session.messages") return messages;
          if (action === "providers.list")
            return [
              {
                id: "provider",
                name: "OpenCode Go",
                models: [
                  model,
                  ...Array.from({ length: 26 }, (_, i) => ({
                    id: `model-${i + 2}`,
                    name: `Workspace model ${i + 2}`,
                    variants: ["low", "medium", "high"],
                  })),
                ],
              },
            ];
          return {};
        },
        onEvent: (cb: any) => {
          callback = cb;
          return () => {};
        },
        filePath: () => "",
      };
    });
    await page.goto("http://127.0.0.1:5189");
    await expect(page.locator(".brand-mark").first()).toBeVisible();
    expect(
      await page
        .locator(".brand-mark")
        .first()
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    ).toBeTruthy();
    await page
      .getByRole("button", { name: "Polish the workspace", exact: true })
      .click();
    await expect(page.locator(".activity-group")).toHaveCount(1);
    await expect(page.locator(".tool-record")).toHaveCount(6);
    await expect(page.locator(".message-author, .moon")).toHaveCount(0);
    const rows = await page
      .locator(".tool-record > button")
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getBoundingClientRect().top),
      );
    expect(
      Math.max(...rows.slice(1).map((top, i) => top - rows[i])),
    ).toBeLessThanOrEqual(32);
    await page.locator(".tool-record > button").first().click();
    await expect(page.locator(".tool-detail").first()).toBeVisible();
    await page.screenshot({
      path: "test-results/polished-activity.png",
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Conversation model" }).click();
    const colors = new Set<string>();
    for (const value of ["0", "1", "2", "3", "4", "5"]) {
      await page.getByRole("slider", { name: "Reasoning effort" }).fill(value);
      colors.add(
        await page
          .locator(".reasoning-control")
          .evaluate((element) =>
            (element as HTMLElement).style.getPropertyValue("--effort-color"),
          ),
      );
    }
    expect(colors.size).toBe(6);
    await page
      .getByRole("button", { name: "Set high reasoning", exact: true })
      .click();
    await expect(page.getByRole("slider")).toHaveAttribute(
      "aria-valuetext",
      "high",
    );
    await page.getByRole("textbox", { name: "Search models" }).fill("no-match");
    await expect(
      page.getByText("No matching models. Try another name."),
    ).toBeVisible();
    await page.getByRole("textbox", { name: "Search models" }).fill("");
    await page.screenshot({
      path: "test-results/polished-model-picker.png",
      animations: "disabled",
    });
    for (const size of [
      { width: 1000, height: 700 },
      { width: 760, height: 600 },
    ]) {
      await page.setViewportSize(size);
      const bounds = await page.locator("#model-picker").boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(56);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(size.width);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      await page.screenshot({
        path: `test-results/polished-${size.width}.png`,
        animations: "disabled",
      });
    }
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.evaluate(() =>
      (window as any).__push(
        Array.from(
          { length: 100 },
          (_, i) => `Paragraph ${i}: verification detail.\n\n`,
        ).join(""),
      ),
    );
    await expect(
      page.getByText("Paragraph 99: verification detail.", { exact: true }),
    ).toBeVisible();
    await page.locator(".conversation").evaluate((element) => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event("scroll"));
    });
    await page.evaluate(() => (window as any).__push("A new update arrived."));
    await expect(
      page.getByText("A new update arrived.", { exact: true }),
    ).toBeAttached();
    expect(
      await page
        .locator(".conversation")
        .evaluate((element) => element.scrollTop),
    ).toBe(0);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.screenshot({
      path: "test-results/polished-providers.png",
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Conversation model" }).click();
    expect(
      await page
        .locator("#model-picker")
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe("none");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "New Chat", exact: true }).click();
    await page
      .getByRole("button", { name: "Toggle sidebar", exact: true })
      .click();
    await page.getByRole("button", { name: "Conversation model" }).click();
    for (const size of [
      { width: 835, height: 660 },
      { width: 760, height: 600 },
      { width: 1440, height: 960 },
      { width: 900, height: 620 },
    ]) {
      await page.setViewportSize(size);
      await expect
        .poll(async () => {
          const rect = await page.locator("#model-picker").boundingBox();
          return (
            !!rect &&
            rect.y >= 64 &&
            rect.x >= 12 &&
            rect.x + rect.width <= size.width - 11 &&
            rect.y + rect.height <= size.height - 11
          );
        })
        .toBeTruthy();
      await expect(
        page.getByRole("slider", { name: "Reasoning effort" }),
      ).toBeInViewport();
      await expect(
        page.getByRole("button", { name: "Connect a provider", exact: true }),
      ).toBeInViewport();
      const panelBounds = (await page.locator("#model-picker").boundingBox())!;
      const footerBounds = (await page
        .getByRole("button", { name: "Connect a provider", exact: true })
        .boundingBox())!;
      expect(footerBounds.y + footerBounds.height).toBeLessThanOrEqual(
        panelBounds.y + panelBounds.height - 5,
      );
      await page.screenshot({
        path: `test-results/model-welcome-${size.width}.png`,
        animations: "disabled",
      });
    }
    await page
      .getByRole("button", { name: "Set low reasoning", exact: true })
      .click();
    await expect(page.getByRole("slider")).toHaveAttribute(
      "aria-valuetext",
      "low",
    );
    await page
      .locator(".workspace-toolbar")
      .click({ position: { x: 200, y: 20 } });
    await expect(page.locator("#model-picker")).toHaveCount(0);
  } finally {
    await browser.close();
    await new Promise<void>((resolve) =>
      server.httpServer.close(() => resolve()),
    );
  }
});
