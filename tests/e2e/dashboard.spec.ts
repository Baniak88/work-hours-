import { test, expect } from "@playwright/test";

test("dashboard shows the selected workplace week and allows a corrected end", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-18T04:00:00Z"));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Utwórz projekt", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nazwa projektu lub pracodawcy" })
    .fill("Bowmill");
  await page
    .getByRole("textbox", { name: "Basic — stawka podstawowa (GBP/h)" })
    .fill("18");
  await page
    .getByRole("textbox", { name: "Tygodniowa norma (godziny:minuty)" })
    .fill("39:00");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await page.getByRole("button", { name: "Zmiana nocna", exact: true }).click();
  async function add(
    startDate: string,
    start: string,
    endDate: string,
    end: string,
  ) {
    await page
      .getByRole("button", { name: "Dodaj wcześniejszą zmianę", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Data rozpoczęcia", exact: true })
      .fill(startDate);
    await page
      .getByRole("textbox", { name: "Godzina rozpoczęcia", exact: true })
      .fill(start);
    await page
      .getByRole("textbox", { name: "Data zakończenia", exact: true })
      .fill(endDate);
    await page
      .getByRole("textbox", { name: "Godzina zakończenia", exact: true })
      .fill(end);
    await page
      .getByRole("textbox", { name: "Niepłatna przerwa (minuty)" })
      .fill("0");
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  }
  await add("2026-11-16", "17:15", "2026-11-17", "03:00");
  await add("2026-11-17", "17:00", "2026-11-18", "03:05");
  await expect(
    page.getByText("19:50 h", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("19:10 h", { exact: true })).toBeVisible();
  await expect(page.getByText("17:15 – 03:00", { exact: true })).toBeVisible();
  await expect(page.getByText("17:00 – 03:05", { exact: true })).toBeVisible();
  await expect(page.getByText("Razem w tygodniu")).toBeVisible();
  await expect(page.getByText("Dodaj urlop", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  for (const value of ["19:50 h", "19:10 h", "04:00:00"]) {
    const box = page.getByText(value, { exact: true }).first();
    await expect(box).toBeVisible();
    expect(
      await box.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/dashboard-new.png",
    fullPage: true,
    scale: "css",
  });
  await page.getByText("Razem w tygodniu").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "artifacts/dashboard-week.png", scale: "css" });
  await page.getByRole("button", { name: "Start zmiany", exact: true }).click();
  await page.clock.setFixedTime(new Date("2026-11-18T04:30:00Z"));
  await page
    .getByRole("button", { name: "Popraw początek", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Godzina rozpoczęcia" })
    .fill("03:10");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Bieżąca zmiana", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Popraw koniec", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Godzina zakończenia" })
    .fill("04:20");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("03:10 – 04:20", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start zmiany", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Dodaj urlop", exact: true }).click();
  await page.getByRole("textbox", { name: "Data urlopu" }).fill("2026-11-19");
  await page
    .getByRole("textbox", { name: "Godziny urlopu (godziny:minuty)" })
    .fill("08:00");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Urlop · 8:00 h", { exact: true })).toBeVisible();
  await expect(
    page.getByText("21:00 h", { exact: true }).first(),
  ).toBeVisible();
});
