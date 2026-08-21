import { expect, test } from "@playwright/test";
test.skip(
  !process.env.E2E_AUTH_STORAGE && process.env.ENABLE_DEMO_MODE !== "true",
  "Set E2E_AUTH_STORAGE for Supabase or ENABLE_DEMO_MODE=true for the local demo workspace.",
);
test("create a goal and a persisted manual task", async ({ page }) => {
  const runId = Date.now().toString(36);
  const goalTitle = `Improve retention ${runId}`;
  const taskTitle = `Interview five customers ${runId}`;
  await page.goto("/app/tasks");
  await expect(
    page.getByRole("heading", { name: "Goals & Tasks" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Goals", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tasks", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create Goal" }).click();
  await page
    .getByRole("dialog", { name: "Create a goal" })
    .getByLabel("Title *")
    .fill(goalTitle);
  await page.getByRole("button", { name: "Save goal" }).click();
  await expect(
    page.getByRole("button").filter({ hasText: goalTitle }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "New task" }).click();
  const dialog = page.getByRole("dialog", { name: "Create a task" });
  await dialog.getByLabel("Title *").fill(taskTitle);
  await dialog.getByLabel("Goal").selectOption({ label: goalTitle });
  await dialog.getByRole("button", { name: "Save task" }).click();
  await expect(page.getByText(taskTitle)).toBeVisible();
  await page.reload();
  await expect(page.getByText(taskTitle)).toBeVisible();

  await page
    .getByRole("button", { name: `Mark task complete: ${taskTitle}` })
    .click();
  await expect(page.getByText(taskTitle)).toBeHidden();
  const taskTabs = page.getByRole("tablist", { name: "Task completion" });
  await taskTabs.getByRole("tab", { name: /Completed/ }).click();
  await expect(page.getByText(taskTitle)).toBeVisible();
  await page.reload();
  await expect(page.getByText(taskTitle)).toBeHidden();
  await taskTabs.getByRole("tab", { name: /Completed/ }).click();
  await page.getByRole("button", { name: `Reopen task: ${taskTitle}` }).click();
  await expect(page.getByText(taskTitle)).toBeHidden();
  await page.reload();
  await expect(page.getByText(taskTitle)).toBeVisible();

  const goalCard = page.locator("article").filter({ hasText: goalTitle });
  await goalCard.getByRole("button", { name: "Mark Goal Complete" }).click();
  const completionDialog = page.getByRole("dialog", { name: "Complete goal" });
  await expect(
    completionDialog.getByText(
      "This goal still has incomplete tasks. How would you like to proceed?",
    ),
  ).toBeVisible();
  await completionDialog
    .getByRole("button", { name: /Complete goal and remaining tasks/ })
    .click();
  await expect(goalCard).toBeHidden();
  await expect(page.getByText(taskTitle)).toBeHidden();

  const goalTabs = page.getByRole("tablist", { name: "Goal completion" });
  await goalTabs.getByRole("tab", { name: /Completed/ }).click();
  const completedGoalCard = page
    .locator("article")
    .filter({ hasText: goalTitle });
  await expect(completedGoalCard).toBeVisible();
  await completedGoalCard.getByRole("button", { name: "Reopen Goal" }).click();
  await expect(completedGoalCard).toBeHidden();
  await goalTabs.getByRole("tab", { name: /Incomplete/ }).click();
  await expect(
    page.locator("article").filter({ hasText: goalTitle }),
  ).toBeVisible();
  await taskTabs.getByRole("tab", { name: /Completed/ }).click();
  await expect(page.getByText(taskTitle)).toBeVisible();
});

test("profile autosave and app shell remain usable across responsive widths", async ({
  page,
}) => {
  const businessName = `Responsive Studio ${Date.now().toString(36)}`;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/profile");
  await expect(
    page.getByRole("heading", { name: "Business Profile" }),
  ).toBeVisible();
  await expect(
    page.locator('header img[src*="main-street-advisor-logo.png"]'),
  ).toBeVisible();
  await expect(
    page.locator("header").getByText("Main Street Advisor"),
  ).toBeVisible();
  await page.getByLabel("Business name").fill(businessName);
  await expect(page.getByLabel("Your name")).toHaveCount(0);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await page.reload();
  await expect(page.getByLabel("Business name")).toHaveValue(businessName);
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  const mobileNavigation = page.getByRole("navigation", {
    name: "Main navigation",
  });
  await expect(
    mobileNavigation.getByRole("link", { name: "Settings" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Account settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/app/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/app");
  await expect(
    page.getByRole("textbox", { name: "Message your business consultant" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  const desktopSidebar = page.locator("aside").first();
  await expect(
    desktopSidebar.locator('img[src*="main-street-advisor-logo.png"]'),
  ).toBeVisible();
  await expect(desktopSidebar.getByText("Main Street Advisor")).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Settings" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Account settings" }),
  ).toHaveAttribute("href", "/app/settings");
});

test("privacy controls, local secret blocking, deletion controls, and headers are visible", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.ENABLE_DEMO_MODE !== "true",
    "This privacy UI check uses the isolated fictional workspace.",
  );

  const response = await request.get("/app/settings");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");

  await page.goto("/app/settings");
  await expect(
    page.getByRole("heading", { name: "AI privacy controls" }),
  ).toBeVisible();
  const memory = page.getByRole("switch", { name: "Previous consultations" });
  await expect(memory).toHaveAttribute("aria-checked", "true");
  await memory.click();
  await expect(memory).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("AI privacy controls saved.")).toBeVisible();
  await expect(
    page.getByText(/Self-service deletion is unavailable/),
  ).toBeVisible();

  await page.goto("/app");
  const composer = page.getByRole("textbox", {
    name: "Message your business consultant",
  });
  await composer.fill("My payment card is 4111 1111 1111 1111");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText(/Please remove payment-card numbers/),
  ).toBeVisible();
  await expect(composer).toHaveValue(
    "My payment card is 4111 1111 1111 1111",
  );

  page.once("dialog", (dialog) => dialog.accept());
  const deleteButton = page
    .getByRole("button", { name: /Delete consultation:/ })
    .first();
  await expect(deleteButton).toBeVisible();
  const deletedName = (await deleteButton.getAttribute("aria-label"))!.replace(
    "Delete consultation: ",
    "",
  );
  await deleteButton.click();
  await expect(page.getByText(deletedName, { exact: true })).toBeHidden();
});
