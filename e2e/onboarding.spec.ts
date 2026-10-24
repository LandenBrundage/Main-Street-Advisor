import { expect, test } from "@playwright/test";
import { profileSchema } from "../src/lib/schemas";

test.skip(
  process.env.ENABLE_DEMO_MODE !== "true",
  "Onboarding checks use only the fictional local workspace.",
);

for (const width of [390, 1280]) {
  test(`required profile, optional uploads, and advisor tour at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    let savedProfile = profileSchema.parse({});
    let writes = 0;
    // Keep each browser's profile isolated from other tests and from persisted business data.
    await page.route("**/api/profile", async (route) => {
      if (route.request().method() === "PUT") {
        savedProfile = profileSchema.parse(route.request().postDataJSON());
        writes += 1;
        await route.fulfill({ json: { saved: true } });
      } else {
        await route.fulfill({ json: { profile: savedProfile } });
      }
    });
    await page.goto("/app/profile");
    await expect(page.getByLabel("Business name (Required)")).toBeVisible();
    // Reset just this fictional account's guide so the test is repeatable.
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (
          key.startsWith("msa:workspace-tour:v1:") &&
          !key.endsWith(":profile-complete")
        ) {
          localStorage.setItem(key, "profile");
          localStorage.setItem(`${key}:profile-complete`, "false");
        }
      }
    });
    await page.reload();
    await expect(
      page.getByRole("dialog", { name: "Start with just five details" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("profile-guide.png"),
      fullPage: false,
    });
    await expect(page.getByRole("dialog")).toHaveCount(1);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(
      "hidden",
    );
    await page.getByRole("button", { name: "Start profile" }).click();
    await expect(page.getByLabel("Business name (Required)")).toBeFocused();

    if (width < 1024)
      await page.getByRole("button", { name: "Open navigation" }).click();
    const home = page.getByRole("button", { name: "Home", exact: true });
    await expect(home).toHaveAttribute("aria-disabled", "true");
    await home.dispatchEvent("click");
    await expect(
      page.getByRole("dialog", { name: "Finish your business profile" }),
    ).toBeVisible();
    await expect(
      page.getByText("A few required details unlock your advisor."),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Go to required fields", exact: true })
      .click();

    await page.getByLabel("Business name (Required)").fill("Northstar Coffee");
    await page.getByLabel("Industry (Required)").fill("Food and beverage");
    await page
      .getByLabel("What does the business do? (Required)")
      .fill("We serve coffee and fresh pastries.");
    await expect(page.getByLabel("Website (Optional)")).toBeVisible();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Business name (Required)")).toHaveValue(
      "Northstar Coffee",
    );
    await expect(
      page.getByRole("dialog", { name: "Start with just five details" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: /Products and services/ }).click();
    await page
      .getByLabel("Main products or services (Required)")
      .fill("Coffee and pastries");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("button", { name: /Customers and market/ }).click();
    await page
      .getByLabel("Ideal customer (Required)")
      .fill("People who live and work nearby");
    await expect(page.getByText("100% of required details")).toBeVisible();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    expect(writes).toBeGreaterThan(0);
    await expect(
      page.getByRole("dialog", { name: "You’re ready to start" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.getByRole("button", { name: "Keep editing" }).click();

    await page.getByRole("button", { name: /Business documents/ }).click();
    await expect(page.getByText(/File uploads are optional/)).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("optional-documents.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Continue to advisor", exact: true })
      .last()
      .click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(
      page.getByRole("dialog", { name: "Your advisor is ready" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("advisor-guide.png"),
      fullPage: false,
    });
    await page.getByRole("button", { name: "Show prompt builder" }).click();
    await expect(
      page.getByRole("dialog", { name: "Need help asking your question?" }),
    ).toBeVisible();
    const promptButton = page.locator('[data-tour-target="prompt-builder"]');
    await expect(promptButton).toContainText("Prompt builder");
    await expect(promptButton).toHaveAttribute("aria-disabled", "true");
    await page.screenshot({
      path: testInfo.outputPath("prompt-button.png"),
      fullPage: false,
    });
    // The highlighted control is only a preview during this step.
    const bounds = await promptButton.boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.click(
      bounds!.x + bounds!.width / 2,
      bounds!.y + bounds!.height / 2,
    );
    await promptButton.dispatchEvent("click");
    await promptButton.evaluate((element) => (element as HTMLElement).focus());
    await expect(promptButton).not.toBeFocused();
    await expect(
      page.getByRole("heading", { name: "Build a clearer business question" }),
    ).toHaveCount(0);
    const promptGuide = page.getByRole("dialog", {
      name: "Need help asking your question?",
    });
    await expect(promptGuide).toBeVisible();
    await promptGuide
      .getByRole("button", { name: "Next", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Find your action plan" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("goals-tab.png"),
      fullPage: false,
    });
    await page
      .getByRole("link", { name: "Goals & Tasks", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Turn advice into progress" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("goals-guide.png"),
      fullPage: false,
    });
    await page.getByRole("button", { name: "View goals and tasks" }).click();
    await expect(page).toHaveURL(/\/app\/tasks$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Goals", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Tasks", exact: true }),
    ).toBeVisible();
    if (width < 1024)
      await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/\/app$/);
    // The builder works normally once the tour has ended.
    await page.getByRole("button", { name: "Build a guided prompt" }).click();
    await page.getByLabel("Goal or challenge").fill("Grow weekday sales");
    await page.getByRole("button", { name: "Build editable prompt" }).click();
    await expect(
      page.getByRole("textbox", { name: "Message your business consultant" }),
    ).toHaveValue(/Grow weekday sales/);
    await page.goto("/app/profile");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByText(/Your required details are filled in/),
    ).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    if (width < 1024)
      await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Message your business consultant" }),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Your advisor is ready" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
