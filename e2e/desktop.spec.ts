import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
test("welcome, responsive controls, engine, projects and persistence", async () => {
  const data = await fs.mkdtemp(path.join(os.tmpdir(), "nightcode-e2e-"));
  const project = await fs.mkdtemp(
    path.join(os.tmpdir(), "nightcode-project-"),
  );
  let app = await electron.launch({
    args: ["."],
    env: { ...process.env, NIGHTCODE_TEST_DATA: data },
  });
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Welcome to NightCode Desktop" }),
    ).toBeVisible();
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.screenshot({ path: "test-results/welcome-desktop.png" });
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window.nightcode.invoke<any>("snapshot").then((s) => s.engine),
          ),
        { timeout: 60000 },
      )
      .toBe("Ready");
    await page
      .getByRole("button", { name: "Toggle sidebar", exact: true })
      .click();
    await expect(page.locator(".app")).toHaveClass(/sidebar-collapsed/);
    await page
      .getByRole("button", { name: "Show sidebar", exact: true })
      .click();
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await page
      .getByRole("textbox", { name: "Message NightCode" })
      .fill("Help me build my first AI app. Start by planning a small project.");
    await expect(
      page.getByRole("textbox", { name: "Message NightCode" }),
    ).toHaveValue(/first AI app/);
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folder],
      });
    }, project);
    const opened = await page.evaluate(() =>
      window.nightcode.invoke<any>("projects.open"),
    );
    expect(opened.path.toLowerCase()).toBe((await fs.realpath(project)).toLowerCase());
    const session = await page.evaluate(
      (projectId) =>
        window.nightcode.invoke<any>("session.create", { projectId }),
      opened.id,
    );
    expect(session.id).toBeTruthy();
    await page.setViewportSize({ width: 820, height: 650 });
    await page.screenshot({ path: "test-results/welcome-small.png" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page.evaluate((projectId) => {
      void window.nightcode
        .invoke("commands.run", {
          projectId,
          command: "Write-Output 'must never run'",
        })
        .catch(() => {});
    }, opened.id);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.nightcode
            .invoke<any>("snapshot")
            .then((s) => s.approvals.some((a: any) => a.status === "pending")),
        ),
      )
      .toBeTruthy();
    await app.close();
    app = await electron.launch({
      args: ["."],
      env: { ...process.env, NIGHTCODE_TEST_DATA: data },
    });
    const restored = await app.firstWindow();
    await expect(
      restored.getByRole("heading", { name: "Welcome to NightCode Desktop" }),
    ).toBeVisible();
    const snap = await restored.evaluate(() =>
      window.nightcode.invoke<any>("snapshot"),
    );
    expect(snap.sessions[0].id).toBe(session.id);
    expect(snap.projects[0].id).toBe(opened.id);
    expect(
      snap.approvals.every((a: any) => a.status !== "pending"),
    ).toBeTruthy();
    expect(snap.commands).toHaveLength(0);
  } finally {
    await app.close();
  }
});
