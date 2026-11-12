import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Slice,
  duration as formatDuration,
  localDate,
  money,
  totals,
} from "../domain";
import { calendarDays, moveMonth } from "../calendar";
type Props = {
  month: string;
  selected: string;
  today: string;
  slices: Slice[];
  currency: string;
  timeFormat?: "clock" | "decimal";
  metric: "hours" | "money";
  onMetric: (metric: "hours" | "money") => void;
  onSelect: (day: string) => void;
  onMonth: (month: string) => void;
};
const C = {
  card: "#1B2325",
  line: "#303D40",
  muted: "#96A7AA",
  text: "#F4F8F5",
  green: "#B4F272",
  day: "#F3CD87",
  night: "#AFB7FF",
};
export default function WorkCalendar(p: Props) {
  const { metric } = p;
  const duration = (minutes: number) => formatDuration(minutes, p.timeFormat);
  const byDay = useMemo(() => {
    const map = new Map<string, Slice[]>();
    p.slices.forEach((s) => {
      if (s.date.startsWith(p.month))
        map.set(s.date, [...(map.get(s.date) ?? []), s]);
    });
    return map;
  }, [p.slices, p.month]);
  const monthTotals = totals([...byDay.values()].flat());
  const cells = calendarDays(p.month);
  function arrow(
    name: "chevron-back" | "chevron-forward",
    label: string,
    offset: number,
  ) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => p.onMonth(moveMonth(p.month, offset))}
        style={s.arrow}
      >
        <Ionicons name={name} size={18} color={C.text} accessible={false} />
      </Pressable>
    );
  }
  return (
    <View style={s.card}>
      <View style={s.header}>
        {arrow("chevron-back", "Poprzedni miesiąc", -1)}
        <Text accessibilityRole="header" style={s.month}>
          {localDate(p.month + "-01").toLocaleDateString("pl-PL", {
            month: "long",
            year: "numeric",
          })}
        </Text>
        {arrow("chevron-forward", "Następny miesiąc", 1)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Przejdź do dzisiaj"
          onPress={() => p.onSelect(p.today)}
          style={s.today}
        >
          <Text style={s.todayText}>Dziś</Text>
        </Pressable>
      </View>
      <View style={s.summary}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.caption}>Czas pracy</Text>
          <Text accessibilityLabel="Godziny w miesiącu" style={s.amount}>
            {duration(monthTotals.minutes)} <Text style={s.unit}>h</Text>
          </Text>
        </View>
        <View style={{ flex: 1, gap: 3, alignItems: "flex-end" }}>
          <Text style={s.caption}>Zarobki</Text>
          <Text
            accessibilityLabel="Zarobki w miesiącu"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              s.amount,
              { color: C.green, flexShrink: 1, textAlign: "right" },
            ]}
          >
            {money(monthTotals.amount, p.currency)}
          </Text>
        </View>
      </View>
      <View style={s.toolbar}>
        <View style={s.legend}>
          <View style={[s.dot, { backgroundColor: C.day }]} />
          <Text style={s.caption}>Dzienna</Text>
          <View style={[s.dot, { backgroundColor: C.night }]} />
          <Text style={s.caption}>Nocna</Text>
        </View>
        <View style={s.metric}>
          {(["hours", "money"] as const).map((key, i) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={
                i ? "Kwoty w kalendarzu" : "Godziny w kalendarzu"
              }
              accessibilityState={{ selected: metric === key }}
              onPress={() => p.onMetric(key)}
              style={[
                s.metricButton,
                metric === key && { backgroundColor: "#3B4943" },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: metric === key ? C.text : C.muted,
                }}
              >
                {i ? "Kwoty" : "Godziny"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={s.week}>
        {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((day) => (
          <Text key={day} style={s.weekday}>
            {day}
          </Text>
        ))}
      </View>
      <View>
        {Array.from({ length: cells.length / 7 }, (_, week) => (
          <View key={week} style={s.weekRow}>
            {cells.slice(week * 7, week * 7 + 7).map((day, i) => {
              if (!day) return <View key={"empty" + i} style={s.cellSlot} />;
              const parts = byDay.get(day) ?? [],
                t = totals(parts),
                selected = day === p.selected,
                today = day === p.today;
              const kinds = new Set(
                parts
                  .filter((x) => x.minutes > 0)
                  .map((x) => x.entry.shift?.kind),
              );
              const amount = new Intl.NumberFormat("en-GB", {
                style: "currency",
                currency: p.currency,
                maximumFractionDigits: 0,
                notation: t.amount >= 1000 ? "compact" : "standard",
              }).format(t.amount);
              return (
                <View key={day} style={s.cellSlot}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Dzień ${day}, ${duration(t.minutes)} godzin, ${money(t.amount, p.currency)}`}
                    accessibilityState={{ selected }}
                    onPress={() => p.onSelect(day)}
                    style={[
                      s.cell,
                      selected && { backgroundColor: C.green },
                      !selected &&
                        t.minutes > 0 && { backgroundColor: "#26352B" },
                      !selected && today && { borderColor: C.green },
                      i >= 5 &&
                        !selected &&
                        !parts.length && { backgroundColor: "#202B2D" },
                    ]}
                  >
                    <Text
                      style={[
                        s.dayNumber,
                        {
                          color: selected
                            ? "#152010"
                            : day > p.today
                              ? "#9AA9AB"
                              : C.text,
                        },
                      ]}
                    >
                      {Number(day.slice(-2))}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        s.value,
                        { color: selected ? "#263B1B" : C.muted },
                      ]}
                    >
                      {parts.length
                        ? metric === "hours"
                          ? duration(t.minutes)
                          : amount
                        : ""}
                    </Text>
                    <View style={s.dots}>
                      {kinds.has("day") && (
                        <View
                          style={[
                            s.dot,
                            { backgroundColor: selected ? "#8C691E" : C.day },
                          ]}
                        />
                      )}
                      {kinds.has("night") && (
                        <View
                          style={[
                            s.dot,
                            { backgroundColor: selected ? "#514794" : C.night },
                          ]}
                        />
                      )}
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <View style={s.footer}>
        <Text style={s.caption}>
          Nadgodziny{" "}
          <Text style={{ color: C.green }}>
            {duration(monthTotals.extra)} h
          </Text>
        </Text>
        <Text style={s.caption}>
          {[...byDay.values()].filter((v) => totals(v).minutes > 0).length} dni
          pracy
        </Text>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 17,
    padding: 12,
  },
  header: { flexDirection: "row", gap: 4, alignItems: "center" },
  arrow: {
    width: 40,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 9,
    backgroundColor: "#283437",
  },
  month: {
    flex: 1,
    textAlign: "center",
    color: C.text,
    fontWeight: "600",
    fontSize: 16,
    textTransform: "capitalize",
  },
  today: {
    paddingHorizontal: 9,
    minHeight: 44,
    justifyContent: "center",
    marginLeft: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.line,
  },
  todayText: { color: C.green, fontSize: 12, fontWeight: "600" },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 8,
    marginVertical: 5,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  caption: { fontSize: 11, lineHeight: 16, color: C.muted },
  amount: {
    fontSize: 22,
    color: C.text,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  unit: { fontSize: 12, color: C.muted },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 8,
  },
  legend: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  metric: {
    flexDirection: "row",
    padding: 3,
    backgroundColor: "#121B1D",
    borderRadius: 8,
  },
  metricButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
  },
  week: { flexDirection: "row", marginBottom: 5 },
  weekday: {
    width: "14.285714%",
    textAlign: "center",
    color: C.muted,
    fontSize: 11,
  },
  weekRow: { flexDirection: "row" },
  cellSlot: { flex: 1, minWidth: 0, padding: 1 },
  cell: {
    minHeight: 48,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },
  dayNumber: { fontSize: 14, fontWeight: "600" },
  value: { fontSize: 10, fontVariant: ["tabular-nums"] },
  dots: { height: 5, flexDirection: "row", alignItems: "center", gap: 2 },
  footer: {
    paddingTop: 8,
    marginTop: 10,
    borderTopWidth: 1,
    borderColor: C.line,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
