import { test, expect } from "@playwright/test";

test("explains an overnight overlap and opens the saved entry without duplicating work", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-19T03:16:00Z"));
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
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await page.getByRole("button", { name: "Zmiana nocna", exact: true }).click();
  async function fillShift(
    date: string,
    start: string,
    endDate: string,
    end: string,
  ) {
    await page
      .getByRole("button", { name: "Dodaj wcześniejszą zmianę", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Data rozpoczęcia", exact: true })
      .fill(date);
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
  await fillShift("2026-11-16", "18:00", "2026-11-17", "03:45");
  await fillShift("2026-11-16", "18:00", "2026-11-17", "03:00");
  await expect(
    page.getByText("Znaleziono nakładającą się pracę"),
  ).toBeVisible();
  await expect(
    page.getByText(/16\.11\.2026.*18:00.*17\.11\.2026.*03:45/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edytuj istniejącą zmianę" }).click();
  await expect(
    page.getByRole("textbox", { name: "Godzina zakończenia", exact: true }),
  ).toHaveValue("03:45");
  await page
    .getByRole("textbox", { name: "Godzina zakończenia", exact: true })
    .fill("03:00");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("18:00 – 03:00", { exact: true })).toBeVisible();
  await expect(page.getByText("9:00 h", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Start zmiany", exact: true }).click();
  await page.clock.setFixedTime(new Date("2026-11-19T04:00:00Z"));
  await fillShift("2026-11-19", "03:20", "2026-11-19", "03:30");
  await expect(
    page.getByText("Aktywny licznik", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Popraw początek licznika" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Popraw początek licznika" }).click();
  await expect(
    page.getByRole("textbox", { name: "Godzina rozpoczęcia", exact: true }),
  ).toHaveValue("03:16");
});
