import { Pressable, Text, View, usePresentation, Icon } from "../ui";
import React, { useState } from "react";
import { StyleSheet } from "react-native";
import { dateKey, localDate } from "../domain";
import { calendarDays, moveMonth } from "../calendar";

// Theme placeholders (mapped per theme by ui.tsx).
const C = {
  raised: "#282A2F",
  muted: "#A0A3AB",
  text: "#F4F4F5",
  accent: "#DCE2EA",
  bg: "#111214",
  selected: "#35383F",
};

/** Days between two YYYY-MM-DD keys, counting both ends. */
export function inclusiveDays(start: string, end: string) {
  return (
    Math.round(
      (localDate(end).getTime() - localDate(start).getTime()) / 864e5,
    ) + 1
  );
}
/**
 * Inline month picker. Tap a day to choose it; with `range`, a second tap on a
 * later day chooses the end of the period and a further tap starts over.
 */
export default function DatePicker({
  value,
  days = 1,
  range = false,
  onPick,
}: {
  value: string;
  days?: number;
  range?: boolean;
  onPick: (start: string, days: number) => void;
}) {
  const { locale } = usePresentation();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const [month, setMonth] = useState(() =>
    (valid ? value : dateKey(Date.now())).slice(0, 7),
  );
  const end = (() => {
    if (!valid || days <= 1) return value;
    const d = localDate(value);
    d.setDate(d.getDate() + days - 1);
    return dateKey(d);
  })();
  const title = localDate(`${month}-01`).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    // 2024-01-01 was a Monday.
    new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "short" }),
  );
  // The first tap always picks the start; the next later tap picks the end.
  const [startPicked, setStartPicked] = useState(false);
  function pick(day: string) {
    if (range && startPicked && valid && day > value) {
      onPick(value, inclusiveDays(value, day));
      setStartPicked(false);
    } else {
      onPick(day, 1);
      setStartPicked(range);
    }
  }
  return (
    <View style={s.card}>
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Poprzedni miesiąc"
          onPress={() => setMonth(moveMonth(month, -1))}
          style={s.arrow}
        >
          <Icon
            name="chevron-back"
            size={18}
            color={C.text}
            accessible={false}
          />
        </Pressable>
        <Text verbatim style={s.title}>
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Następny miesiąc"
          onPress={() => setMonth(moveMonth(month, 1))}
          style={s.arrow}
        >
          <Icon
            name="chevron-forward"
            size={18}
            color={C.text}
            accessible={false}
          />
        </Pressable>
      </View>
      <View style={s.row}>
        {weekdays.map((d) => (
          <Text verbatim key={d} style={s.weekday}>
            {d}
          </Text>
        ))}
      </View>
      <View style={s.grid}>
        {calendarDays(month).map((day, i) => {
          const chosen = !!day && valid && day >= value && day <= end;
          const edge = day === value || day === end;
          return (
            <View key={day ?? `empty-${i}`} style={s.slot}>
              {day && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={day}
                  accessibilityState={{ selected: chosen }}
                  onPress={() => pick(day)}
                  style={[
                    s.day,
                    chosen && { backgroundColor: C.selected },
                    chosen && edge && { backgroundColor: C.accent },
                  ]}
                >
                  <Text
                    verbatim
                    style={[
                      s.dayText,
                      chosen && edge && { color: C.bg, fontWeight: "700" },
                    ]}
                  >
                    {Number(day.slice(8))}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
      {range && (
        <Text style={s.hint}>
          Dotknij pierwszego dnia, a potem ostatniego dnia urlopu.
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: "#1C1D20",
    borderRadius: 22,
    borderCurve: "continuous",
    padding: 12,
    gap: 6,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.raised,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: C.text,
    textTransform: "capitalize",
  },
  row: { flexDirection: "row" },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    color: C.muted,
    textTransform: "capitalize",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  slot: { width: "14.285714%", padding: 2 },
  day: {
    height: 40,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontSize: 15, color: C.text, fontVariant: ["tabular-nums"] },
  hint: { fontSize: 12, lineHeight: 17, color: C.muted, textAlign: "center" },
});
