import { test, expect } from "@playwright/test";

test("overnight entry explains the full shift and its daily breakdown", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Utwórz projekt", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nazwa projektu lub pracodawcy" })
    .fill("Test");
  await page
    .getByRole("textbox", { name: "Basic — stawka podstawowa (GBP/h)" })
    .fill("20");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await page.getByRole("button", { name: "Dodaj wcześniejszą zmianę" }).click();
  await page
    .getByRole("textbox", { name: "Data rozpoczęcia", exact: true })
    .fill("2026-11-10");
  await page
    .getByRole("textbox", { name: "Godzina rozpoczęcia", exact: true })
    .fill("17:30");
  await page
    .getByRole("textbox", { name: "Data zakończenia", exact: true })
    .fill("2026-11-11");
  await page
    .getByRole("textbox", { name: "Godzina zakończenia", exact: true })
    .fill("03:00");
  await page
    .getByRole("textbox", { name: "Niepłatna przerwa (minuty)" })
    .fill("30");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await page.getByRole("button", { name: "Pokaż obliczenia" }).click();
  await expect(page.getByText("Jak obliczono tę zmianę?")).toBeVisible();
  await expect(page.getByText("9:00 h × £20.00/h = £180.00")).toBeVisible();
  await expect(page.getByText("0:00 h × £30.00/h = £0.00")).toBeVisible();
  await expect(page.getByText("Podział między dni")).toHaveCount(0);
  await page.getByRole("tab", { name: "Ustawienia", exact: true }).click();
  await page.getByRole("button", { name: /Wyświetlanie i waluta/ }).click();
  await page.getByRole("radio", { name: "Podział o północy" }).click();
  await page
    .getByRole("radio", { name: "Cała zmiana w tygodniu startu" })
    .click();
  await expect(
    page.getByText("Zmienić sposób liczenia tygodnia?"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zmień sposób liczenia" }).click();
  await page.reload();
  await page.getByRole("tab", { name: "Ustawienia", exact: true }).click();
  await page.getByRole("button", { name: /Wyświetlanie i waluta/ }).click();
  await page.getByRole("tab", { name: "Pulpit", exact: true }).click();
  await page.getByRole("button", { name: "Pokaż obliczenia" }).click();
  await expect(page.getByText("Podział między dni")).toBeVisible();
  await expect(
    page.getByText("6:30 h", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("2:30 h", { exact: false }).first(),
  ).toBeVisible();
});
