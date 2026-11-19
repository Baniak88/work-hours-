import { expect, test } from "@playwright/test";

test("secondary actions are outlined and accessible in light and dark themes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Utwórz projekt", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nazwa projektu lub pracodawcy" })
    .fill("Praca");
  await page
    .getByRole("textbox", { name: "Basic — stawka podstawowa (GBP/h)" })
    .fill("10");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  const controls = [
    "Dopasuj stan z czytnika",
    "Start od godziny",
    "Dodaj urlop",
  ];
  for (const name of controls) {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toBeVisible();
    expect(
      await button.evaluate((el) =>
        parseFloat(getComputedStyle(el).borderTopWidth),
      ),
    ).toBeGreaterThanOrEqual(1);
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page
    .getByRole("button", { name: "Dopasuj stan z czytnika" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/outline-pastel.png", scale: "css" });
  await page.getByRole("button", { name: "Dopasuj stan z czytnika" }).click();
  await expect(
    page.getByText("Dopasuj stan godzin", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zamknij formularz" }).click();
  await page.getByRole("tab", { name: "Ustawienia", exact: true }).click();
  await page.getByRole("button", { name: "Grafit", exact: true }).click();
  await page.getByRole("tab", { name: "Pulpit", exact: true }).click();
  for (const name of controls) {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toBeVisible();
    expect(
      await button.evaluate((el) =>
        parseFloat(getComputedStyle(el).borderTopWidth),
      ),
    ).toBeGreaterThanOrEqual(1);
  }
  await page.screenshot({
    path: "artifacts/outline-graphite.png",
    scale: "css",
  });
});
