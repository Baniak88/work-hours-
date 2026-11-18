import { english } from "./translations";
export type Language = "pl" | "en";
type Rule = [RegExp, (...parts: string[]) => string];
const rules: Rule[] = [
  [
    /^Przerwa automatyczna: (\d+) min na zmianę\. Jeśli zapisane przerwy są krótsze, brakujący czas odejmiemy po zakończeniu\. Wyniki na żywo jeszcze go nie uwzględniają\.$/,
    (minutes) =>
      `Automatic break: ${minutes} minutes per shift. If recorded breaks are shorter, the missing time is deducted when the shift ends. Live totals do not include it yet.`,
  ],
  [/^Stawka urlopu \((.+)\)$/, (unit) => `Holiday rate (${unit})`],
  [
    /^(\d+) dni · (.+) h · (.+)$/,
    (days, hours, amount) => `${days} days · ${hours} h · ${amount}`,
  ],
  [/^Do nadgodzin (.+) h$/, (time) => `${time} h until overtime`],
  [
    /^Basic — stawka podstawowa \((.+)\)$/,
    (unit) => `Basic — hourly rate (${unit})`,
  ],
  [
    /^Edytuj wpis (.+) (\d{4}-\d{2}-\d{2})$/,
    (name, date) => `Edit entry ${name} ${date}`,
  ],
  [/^Edytuj projekt (.+)$/, (name) => `Edit project ${name}`],
  [/^Wybierz projekt (.+)$/, (name) => `Select project ${name}`],
  [/^Ustawienia projektu (.+)$/, (name) => `Project settings ${name}`],
  [/^Edytuj: (.+)$/, (name) => `Edit: ${translateText(name, "en")}`],
  [/^Przywróć (.+)$/, (name) => `Restore ${name}`],
  [/^Archiwizuj (.+)$/, (name) => `Archive ${name}`],
  [/^Usuń (.+) i wpisy$/, (name) => `Delete ${name} and entries`],
  [/^Usunąć (.+)\?$/, (name) => `Delete ${name}?`],
  [
    /^Zmienić walutę na (.+)\?$/,
    (currency) => `Change currency to ${currency}?`,
  ],
  [
    /^(\d+) wpisów · (\d+) miejsc pracy$/,
    (entries, jobs) => `${entries} entries · ${jobs} workplaces`,
  ],
  [/^Do normy (.+) h$/, (time) => `${time} h until target`],
  [/^Ponad normę (.+) h$/, (time) => `${time} h overtime`],
  [
    /^Wcześniej (.+) h tej zmiany$/,
    (time) => `${time} h already worked this shift`,
  ],
  [
    /^Zmiana zakończona automatycznie o (.+)\.$/,
    (time) => `Shift stopped automatically at ${time}.`,
  ],
  [
    /^Dzień (.+), (.+) godzin, (.+)$/,
    (day, hours, money) => `Day ${day}, ${hours} hours, ${money}`,
  ],
  [
    /^Auto-stop (.+) o (.+)\. Kolejną zmianę uruchomisz samodzielnie\.$/,
    (day, time) =>
      `Auto-stop ${day === "dzisiaj" ? "today" : day} at ${time}. Start your next shift manually.`,
  ],
  [
    /^Usuniemy (\d+) przykładowych wpisów i nieużywany projekt przykładowy\. Twoje własne wpisy, aktywny licznik, stawki i ustawienia zostaną zachowane\.$/,
    (count) =>
      `Delete ${count} sample entries and the unused sample project. Your own entries, active timer, rates and settings will be kept.`,
  ],
  [
    /^Usuniemy wszystkie (\d+) wpisów, projekty i oznaczenia wypłat z tego urządzenia\. Zostawimy profile zmian, walutę i ustawienia\. Tej operacji nie można cofnąć bez kopii JSON\.$/,
    (count) =>
      `Delete all ${count} entries, projects and payment marks on this device. Shift profiles, currency and preferences will be kept. A JSON backup is required to undo this.`,
  ],
  [
    /^Usuniemy projekt oraz (\d+) jego wpisów\. Inne miejsca pracy zostaną zachowane\. Przywrócenie wymaga kopii JSON\.$/,
    (count) =>
      `Delete this project and its ${count} entries. Other workplaces will be kept. A JSON backup is required to restore it.`,
  ],
  [
    /^Plik zawiera (\d+) projektów i (\d+) wpisów \((.+)\)\. Zastąpi wszystkie obecne dane, w tym licznik\. Najpierw zapisz kopię obecnych danych, jeśli chcesz je zachować\.$/,
    (jobs, entries, currency) =>
      `This file contains ${jobs} projects and ${entries} entries (${currency}). It will replace all current data, including the timer. Save a backup first if you want to keep your current data.`,
  ],
  [/^ · do (.+)$/, (date) => ` · until ${date}`],
];
export function translateText(
  value: string,
  language: Language = "pl",
): string {
  if (language === "pl") return value;
  if (english[value]) return english[value];
  for (const [pattern, replace] of rules) {
    const match = value.match(pattern);
    if (match) return replace(...match.slice(1));
  }
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (english[trimmed])
    return (
      value.slice(0, value.indexOf(value.trim())) +
      english[trimmed] +
      value.slice(value.trimEnd().length)
    );
  return value;
}
