import { test, expect, type Page } from "@playwright/test";

async function withinScreen(page: Page) {
  const overflows = await page
    .locator('[role="button"], [role="tab"], input')
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        if (
          !rect.width ||
          !rect.height ||
          rect.bottom <= 0 ||
          rect.top >= innerHeight
        )
          return [];
        // Horizontal scrollers deliberately keep offscreen chips outside the viewport.
        for (
          let parent = element.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          const css = getComputedStyle(parent);
          if (
            /(auto|scroll)/.test(css.overflowX) &&
            parent.scrollWidth > parent.clientWidth + 1
          )
            return [];
        }
        return rect.left < -1 || rect.right > innerWidth + 1
          ? [
              `${element.getAttribute("aria-label") || element.textContent}: ${Math.round(rect.left)}..${Math.round(rect.right)}`,
            ]
          : [];
      }),
    );
  expect(overflows).toEqual([]);
}

test("main screens and forms remain usable on narrow phones", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-19T04:00:00Z"));
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Utwórz projekt", exact: true })
    .click();
  await withinScreen(page);
  await page
    .getByRole("textbox", { name: "Nazwa projektu lub pracodawcy" })
    .fill("Przykładowe bardzo długie miejsce pracy");
  await page
    .getByRole("textbox", { name: "Basic — stawka podstawowa (GBP/h)" })
    .fill("18");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await page.getByRole("button", { name: "Dodaj wcześniejszą zmianę" }).click();
  await withinScreen(page);
  await page.screenshot({
    path: "artifacts/layout-entry-form.png",
    scale: "css",
  });
  await page
    .getByRole("textbox", { name: "Data rozpoczęcia", exact: true })
    .fill("2026-11-18");
  await page
    .getByRole("textbox", { name: "Godzina rozpoczęcia", exact: true })
    .fill("17:30");
  await page
    .getByRole("textbox", { name: "Data zakończenia", exact: true })
    .fill("2026-11-19");
  await page
    .getByRole("textbox", { name: "Godzina zakończenia", exact: true })
    .fill("03:00");
  await page
    .getByRole("textbox", { name: "Niepłatna przerwa (minuty)" })
    .fill("30");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  const dismiss = page.getByRole("button", { name: "Zamknij komunikat" });
  if (await dismiss.isVisible()) await dismiss.click();
  const details = page.getByRole("button", { name: "Pokaż obliczenia" });
  await details.scrollIntoViewIfNeeded();
  const entry = page
    .getByRole("button", { name: /Edytuj wpis Przykładowe/ })
    .last();
  const entryBox = await entry.boundingBox();
  const detailsBox = await details.boundingBox();
  expect(
    entryBox && detailsBox && detailsBox.y - (entryBox.y + entryBox.height),
  ).toBeGreaterThanOrEqual(12);
  await withinScreen(page);
  await page.screenshot({ path: "artifacts/layout-home.png", scale: "css" });
  await details.click();
  await expect(page.getByText("Jak obliczono tę zmianę?")).toBeVisible();
  await withinScreen(page);
  for (const [tab, name, heading] of [
    ["Kalendarz", "calendar", "Kalendarz pracy."],
    ["Raporty", "reports", "Raport pracy"],
    ["Ustawienia", "settings", "Stawki i zmiany."],
  ] as const) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(page.getByText(heading, { exact: true })).toBeVisible();
    await withinScreen(page);
    await page.screenshot({
      path: `artifacts/layout-${name}.png`,
      scale: "css",
    });
    if (name === "calendar") {
      await page.getByRole("tab", { name: "Widok listy" }).click();
      await withinScreen(page);
      const heading = await page
        .getByText("Twój czas w szczegółach.", { exact: true })
        .boundingBox();
      expect(heading?.height).toBeLessThan(85);
      const money = await page
        .getByText("£162.00", { exact: true })
        .first()
        .boundingBox();
      expect(money?.height).toBeLessThan(35);
      await page.screenshot({
        path: "artifacts/layout-list.png",
        scale: "css",
      });
    }
    if (name === "reports") {
      await page
        .getByText("Wszystkie projekty", { exact: true })
        .scrollIntoViewIfNeeded();
      await withinScreen(page);
      await page.screenshot({
        path: "artifacts/layout-reports-lower.png",
        scale: "css",
      });
      await page.getByRole("tab", { name: "Rozliczenia", exact: true }).click();
      await withinScreen(page);
      await page.screenshot({
        path: "artifacts/layout-payments.png",
        scale: "css",
      });
    }
  }
  await page.getByRole("button", { name: "Grafit", exact: true }).click();
  await page.getByRole("button", { name: /Wyświetlanie i waluta/ }).click();
  await withinScreen(page);
  await page.screenshot({
    path: "artifacts/layout-settings-expanded.png",
    scale: "css",
  });
  await page.getByRole("tab", { name: "Pulpit", exact: true }).click();
  await page.getByRole("button", { name: "Dopasuj stan z czytnika" }).click();
  await expect(
    page.getByText("Dopasuj stan godzin", { exact: true }),
  ).toBeVisible();
  await withinScreen(page);
  await page.screenshot({
    path: "artifacts/layout-balance-form.png",
    scale: "css",
  });
  await page.getByRole("button", { name: "Zamknij formularz" }).click();
  await page.getByRole("button", { name: "Dodaj urlop", exact: true }).click();
  await expect(
    page.getByText("Dodaj urlop", { exact: true }).last(),
  ).toBeVisible();
  await withinScreen(page);
  await page.screenshot({
    path: "artifacts/layout-holiday-form.png",
    scale: "css",
  });
  await page.getByRole("button", { name: "Zamknij formularz" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await withinScreen(page);
});
