import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("personal workflow: projects, entry calculations, persisted timer, export, and payments", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("Twój zegar pracy.")).toBeVisible();
  await page
    .getByRole("button", { name: "Utwórz projekt", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nazwa projektu lub pracodawcy" })
    .fill("Bowmill");
  await page
    .getByRole("textbox", { name: "Basic — stawka podstawowa (GBP/h)" })
    .fill("20");
  await page
    .getByRole("textbox", { name: "Overtime rate — nadgodziny (GBP/h)" })
    .fill("25");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Wybierz projekt Bowmill" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Kalendarz", exact: true }).click();
  await page.getByRole("tab", { name: "Widok listy", exact: true }).click();
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
  await page.getByRole("button", { name: "Start zmiany", exact: true }).click();
  await expect(
    page.getByText("W TRAKCIE PRACY", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Przerwa", exact: true }).click();
  await expect(page.getByText("CZAS NA PRZERWĘ")).toBeVisible();
  await page.reload();
  await expect(page.getByText("CZAS NA PRZERWĘ")).toBeVisible();
  await page.getByRole("button", { name: "Wznów", exact: true }).click();
  await page
    .getByRole("button", { name: "Zakończ zmianę", exact: true })
    .click();
  await expect(page.getByText("GOTOWY DO STARTU")).toBeVisible();
  await page.getByRole("tab", { name: "Raporty", exact: true }).click();
  await page.getByRole("tab", { name: "Rozliczenia", exact: true }).click();
  await page
    .getByRole("button", { name: "Oznacz jako opłacone", exact: true })
    .last()
    .click();
  await expect(page.getByText("Opłacono", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Ustawienia", exact: true }).click();
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
  await page.getByRole("tab", { name: "Kalendarz", exact: true }).click();
  await page.getByRole("tab", { name: "Widok listy", exact: true }).click();
  await expect(page.getByText("£197.50").first()).toBeVisible();
  expect(errors).toEqual([]);
});
test("demo preview on mobile and desktop has no horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Ustawienia", exact: true }).click();
  await page.getByRole("button", { name: /Wypróbuj dane przykładowe/ }).click();
  await page
    .getByRole("button", { name: "Wczytaj przykład", exact: true })
    .click();
  await expect(page.getByText("Twój zegar pracy.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zamknij formularz" }),
  ).toBeHidden();
  await expect(page.locator('[aria-modal="true"]')).toBeHidden();
  await expect(page.getByText("Twój zegar pracy.")).toBeInViewport();
  await page.getByRole("button", { name: "Zamknij komunikat" }).click();
  await page
    .getByRole("button", { name: "Wybierz zmianę: Zmiana nocna", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start zmiany", exact: true }),
  ).toBeInViewport();
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
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(
    page.getByRole("button", { name: "Start zmiany", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "artifacts/mobile-small.png", scale: "css" });
  await page.setViewportSize({ width: 390, height: 664 });
  await page.getByRole("tab", { name: "Kalendarz", exact: true }).click();
  await page.getByRole("tab", { name: "Widok listy", exact: true }).click();
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
  await expect(page.getByText("Twój zegar pracy.")).toBeInViewport();
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

test("night shift settings, actual arrival, capped auto-stop after closing, and next shift waiting", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-10T17:30:00Z"));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Utwórz projekt", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nazwa projektu lub pracodawcy" })
    .fill("Bowmill");
  await page
    .getByRole("textbox", { name: "Basic — stawka podstawowa (GBP/h)" })
    .fill("20");
  await page
    .getByRole("textbox", { name: "Overtime rate — nadgodziny (GBP/h)" })
    .fill("25");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await page.getByRole("tab", { name: "Ustawienia", exact: true }).click();
  await page
    .getByRole("button", { name: "Edytuj: Zmiana nocna", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Początek zmiany", exact: true }),
  ).toHaveValue("17:30");
  await expect(
    page.getByRole("textbox", { name: "Koniec zmiany", exact: true }),
  ).toHaveValue("03:00");
  await page
    .getByRole("textbox", { name: "Norma godzin na zmianę" })
    .fill("7,5");
  await page
    .getByRole("button", {
      name: "Automatycznie o godzinie końca",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await page.getByRole("tab", { name: "Pulpit", exact: true }).click();
  await page
    .getByRole("button", { name: "Wybierz zmianę: Zmiana nocna", exact: true })
    .click();
  await expect(page.getByText("Norma 7:30 h", { exact: true })).toBeVisible();
  await expect(page.getByText(/Auto-stop 2026-11-11 o 03:00/)).toBeVisible();
  await page.getByRole("button", { name: "Start zmiany", exact: true }).click();
  await expect(
    page.getByText("W TRAKCIE PRACY", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/mobile-night-active.png",
    scale: "css",
  });
  await page.getByRole("tab", { name: "Kalendarz", exact: true }).click();
  await page.getByRole("tab", { name: "Widok listy", exact: true }).click();
  await page.clock.setFixedTime(new Date("2026-11-11T10:00:00Z"));
  // Reload simulates closing the application before the scheduled end.
  await page.reload();
  await page.getByRole("tab", { name: "Pulpit", exact: true }).click();
  await expect(page.getByText("GOTOWY DO STARTU")).toBeVisible();
  await expect(page.getByText("Ostatnia zmiana zakończona")).toBeVisible();
  await page.getByRole("tab", { name: "Kalendarz", exact: true }).click();
  await page.getByRole("tab", { name: "Widok listy", exact: true }).click();
  await page.getByRole("button", { name: "Pokaż filtry", exact: true }).click();
  await page.getByRole("button", { name: "Nocne", exact: true }).click();
  await expect(page.getByText("£200.00").first()).toBeVisible();
  await page.getByRole("tab", { name: "Dni", exact: true }).click();
  await expect(
    page.getByText(/norma 7:30 h · auto-stop/).first(),
  ).toBeVisible();
  const entry = page
    .getByRole("button", { name: "Edytuj wpis Bowmill 2026-11-10" })
    .first();
  await entry.click();
  await expect(
    page.getByRole("textbox", { name: "Godzina rozpoczęcia", exact: true }),
  ).toHaveValue("17:30");
  await expect(
    page.getByRole("textbox", { name: "Data zakończenia", exact: true }),
  ).toHaveValue("2026-11-11");
  await expect(
    page.getByRole("textbox", { name: "Godzina zakończenia", exact: true }),
  ).toHaveValue("03:00");
  await page.getByRole("button", { name: "Zamknij formularz" }).click();
  await page.getByRole("tab", { name: "Pulpit", exact: true }).click();
  await page.waitForURL("http://127.0.0.1:8081/");
  await page.reload();
  await expect(page.getByText("GOTOWY DO STARTU")).toBeVisible();
  await page.getByRole("tab", { name: "Ustawienia", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: /Zapisz kopię zapasową/ }).click();
  const saved = JSON.parse(
    await readFile((await (await downloaded).path())!, "utf8"),
  );
  expect(saved.entries).toHaveLength(1);
  expect(saved.timer).toBeNull();
  expect(saved.entries[0].shift.kind).toBe("night");
});

test("fixed overtime rates, monthly calendar, overnight day details, historical correction and deletion", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-12T12:00:00Z"));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Utwórz projekt", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Nazwa projektu lub pracodawcy" })
    .fill("Bowmill");
  await page
    .getByRole("textbox", { name: "Basic — stawka podstawowa (GBP/h)" })
    .fill("20");
  await page
    .getByRole("textbox", { name: "Overtime rate — nadgodziny (GBP/h)" })
    .fill("25");
  await page
    .getByRole("textbox", { name: "Overtime rate — nadgodziny (GBP/h)" })
    .fill("35");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await page.getByRole("tab", { name: "Kalendarz", exact: true }).click();
  await expect(page.getByText("Kalendarz pracy.")).toBeVisible();
  await page.getByRole("button", { name: /^Dzień 2026-11-10,/ }).click();
  await page.getByRole("button", { name: "Dodaj wpis", exact: true }).click();
  await page.getByRole("button", { name: "Zmiana nocna", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Data rozpoczęcia", exact: true }),
  ).toHaveValue("2026-11-10");
  await expect(
    page.getByRole("textbox", { name: "Data zakończenia", exact: true }),
  ).toHaveValue("2026-11-11");
  await page
    .getByRole("textbox", { name: "Niepłatna przerwa (minuty)" })
    .fill("0");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(
    page.getByText("£212.50", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /^Dzień 2026-11-10, 6:30 godzin, £130.00/,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Dzień 2026-11-11, 3:00 godzin, £82.50/ })
    .click();
  await expect(page.getByText("£82.50", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("tab", { name: "Kwoty w kalendarzu", exact: true })
    .click();
  await page.getByRole("button", { name: "Zamknij komunikat" }).click();
  await page
    .getByText("Kalendarz pracy.", { exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: /^Dzień 2026-11-30,/ }),
  ).toBeInViewport();
  await page.screenshot({
    path: "artifacts/calendar-fixed-rates.png",
    scale: "css",
  });
  await page.getByRole("tab", { name: "Pulpit", exact: true }).click();
  await page
    .getByRole("button", { name: "Edytuj projekt Bowmill", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Overtime rate — nadgodziny (GBP/h)" })
    .fill("45");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await page.getByRole("tab", { name: "Kalendarz", exact: true }).click();
  await expect(
    page.getByText("£212.50", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Dzień 2026-11-10,/ }).click();
  await page
    .getByRole("button", {
      name: "Edytuj wpis Bowmill 2026-11-10",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Edytuj stawki tego wpisu", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Overtime rate — nadgodziny (GBP/h)" }),
  ).toHaveValue("35");
  await page
    .getByRole("textbox", { name: "Overtime rate — nadgodziny (GBP/h)" })
    .fill("40");
  await page
    .getByRole("button", { name: "Edytuj stawki tego wpisu", exact: true })
    .click();
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(
    page.getByText("£220.00", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /^Dzień 2026-11-11, 3:00 godzin, £90.00/,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Poprzedni miesiąc" }).click();
  await expect(
    page.getByText("październik 2026", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Następny miesiąc" }).click();
  await expect(
    page.getByText("£220.00", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Przejdź do dzisiaj" }).click();
  await expect(page.getByText("Brak wpisów w tym dniu")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/calendar-small.png", scale: "css" });
  await page.getByRole("button", { name: /^Dzień 2026-11-10,/ }).click();
  await page
    .getByRole("button", {
      name: "Edytuj wpis Bowmill 2026-11-10",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Usuń wpis", exact: true }).click();
  await page.getByRole("button", { name: "Usuń wpis", exact: true }).click();
  await expect(page.getByText("Brak wpisów w tym dniu")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Dzień 2026-11-11, 0:00 godzin, £0.00/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
