import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("personal workflow: projects, entry calculations, persisted timer, export, and payments", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("Dobry dzień do pracy.")).toBeVisible();
  await page
    .getByRole("button", { name: "Utwórz projekt", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nazwa projektu lub pracodawcy" })
    .fill("Bowmill");
  await page
    .getByRole("textbox", { name: "Stawka godzinowa (GBP)" })
    .fill("20");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Wybierz projekt Bowmill" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Wpisy", exact: true }).click();
  await page.getByRole("button", { name: "Dodaj wpis", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Data rozpoczęcia", exact: true })
    .fill("2026-10-20");
  await page
    .getByRole("textbox", { name: "Godzina rozpoczęcia", exact: true })
    .fill("06:00");
  await page
    .getByRole("textbox", { name: "Data zakończenia", exact: true })
    .fill("2026-10-20");
  await page
    .getByRole("textbox", { name: "Godzina zakończenia", exact: true })
    .fill("16:00");
  await page
    .getByRole("textbox", { name: "Niepłatna przerwa (minuty)" })
    .fill("30");
  await page
    .getByRole("textbox", { name: "Notatka (opcjonalnie)" })
    .fill("Poranna zmiana");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("£197.50").first()).toBeVisible();
  await page.getByRole("tab", { name: "Dni", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edytuj wpis Bowmill 2026-10-20" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edytuj wpis Bowmill 2026-10-20" })
    .click();
  await page
    .getByRole("textbox", { name: "Godzina zakończenia", exact: true })
    .fill("05:00");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText(/Koniec pracy musi wypadać/)).toBeVisible();
  await page.getByRole("button", { name: "Zamknij formularz" }).click();
  await page.getByRole("tab", { name: "Pulpit", exact: true }).click();
  await page
    .getByRole("button", { name: "Rozpocznij pracę", exact: true })
    .click();
  await expect(
    page.getByText("W TRAKCIE PRACY", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Przerwa", exact: true }).click();
  await expect(page.getByText("CZAS NA PRZERWĘ")).toBeVisible();
  await page.reload();
  await expect(page.getByText("CZAS NA PRZERWĘ")).toBeVisible();
  await page.getByRole("button", { name: "Wznów", exact: true }).click();
  await page.getByRole("button", { name: "Zakończ", exact: true }).click();
  await expect(page.getByText("GOTOWY DO STARTU")).toBeVisible();
  await page.getByRole("tab", { name: "Raporty", exact: true }).click();
  await page.getByRole("tab", { name: "Rozliczenia", exact: true }).click();
  await page
    .getByRole("button", { name: "Oznacz jako opłacone", exact: true })
    .last()
    .click();
  await expect(page.getByText("Opłacono", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Więcej", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Zapisz kopię zapasową/ }).click();
  const backupDownload = await download;
  expect(backupDownload.suggestedFilename()).toMatch(/work-hours-.*\.json/);
  const backup = JSON.parse(
    await readFile((await backupDownload.path())!, "utf8"),
  );
  expect(backup.entries).toHaveLength(2);
  backup.jobs[0].name = "Bowmill restored";
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Przywróć z pliku/ }).click();
  await (
    await chooser
  ).setFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(
    page.getByText("Przywrócić kopię?", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zastąp dane", exact: true }).click();
  await expect(
    page.getByText("Bowmill restored", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Wpisy", exact: true }).click();
  await expect(page.getByText("£197.50").first()).toBeVisible();
  expect(errors).toEqual([]);
});
test("demo preview on mobile and desktop has no horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Więcej", exact: true }).click();
  await page.getByRole("button", { name: /Wypróbuj dane przykładowe/ }).click();
  await page
    .getByRole("button", { name: "Wczytaj przykład", exact: true })
    .click();
  await expect(page.getByText("Dobry dzień do pracy.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zamknij formularz" }),
  ).toBeHidden();
  await expect(page.locator('[aria-modal="true"]')).toBeHidden();
  await expect(page.getByText("Dobry dzień do pracy.")).toBeInViewport();
  await page.getByRole("button", { name: "Zamknij komunikat" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/mobile-home.png",
    fullPage: true,
    scale: "css",
  });
  await page.getByRole("tab", { name: "Wpisy", exact: true }).click();
  await expect(page.getByText("Twój czas w szczegółach.")).toBeInViewport();
  await page.screenshot({
    path: "artifacts/mobile-entries.png",
    fullPage: true,
    scale: "css",
  });
  await page.getByRole("tab", { name: "Raporty", exact: true }).click();
  await expect(page.getByText("Wiesz, ile pracujesz.")).toBeInViewport();
  await page.screenshot({
    path: "artifacts/mobile-reports.png",
    fullPage: true,
    scale: "css",
  });
  await page.setViewportSize({ width: 1440, height: 1040 });
  await page.getByRole("tab", { name: "Pulpit", exact: true }).click();
  await expect(page.getByText("Dobry dzień do pracy.")).toBeInViewport();
  await page.screenshot({
    path: "artifacts/desktop-home.png",
    fullPage: true,
    scale: "css",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
