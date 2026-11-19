import { test, expect } from "@playwright/test";

test("balance from the clock changes the weekly target without changing saved pay", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-19T04:00:00Z"));
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
  async function add(day: string, start: string, next: string, end: string) {
    await page
      .getByRole("button", { name: "Dodaj wcześniejszą zmianę", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Data rozpoczęcia", exact: true })
      .fill(day);
    await page
      .getByRole("textbox", { name: "Godzina rozpoczęcia", exact: true })
      .fill(start);
    await page
      .getByRole("textbox", { name: "Data zakończenia", exact: true })
      .fill(next);
    await page
      .getByRole("textbox", { name: "Godzina zakończenia", exact: true })
      .fill(end);
    await page
      .getByRole("textbox", { name: "Niepłatna przerwa (minuty)" })
      .fill("0");
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  }
  await add("2026-11-16", "18:00", "2026-11-17", "03:45");
  await add("2026-11-17", "18:00", "2026-11-18", "03:45");
  await add("2026-11-18", "17:35", "2026-11-19", "03:52");
  await expect(
    page.getByText("29:47 h", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("£536.10", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Dopasuj stan z czytnika" })
    .first()
    .click();
  await page.screenshot({ path: "artifacts/balance-adjustment.png", scale: "css" });
  await page
    .getByRole("textbox", { name: "Stan godzin (godziny:minuty)" })
    .fill("29:28");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(
    page.getByText("29:28 h", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("9:32 h", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("£536.10", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Korekta salda", { exact: true })).toBeVisible();
  await expect(page.getByText("−0:19 h", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("29:28 h", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("£536.10", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start zmiany", exact: true }).click();
  await page.clock.setFixedTime(new Date("2026-11-19T13:40:00Z"));
  await page
    .getByRole("button", { name: "Zakończ zmianę", exact: true })
    .click();
  await expect(
    page.getByText("39:08 h", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("0:08 h", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("£711.30", { exact: true }).first(),
  ).toBeVisible();
});
