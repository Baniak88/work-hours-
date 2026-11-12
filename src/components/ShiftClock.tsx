import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  dateKey,
  duration,
  shiftEnd,
  timerMinutes,
  timeLabel,
  type Shift,
  type Timer,
} from "../domain";
const color = {
  bg: "#111719",
  card: "#1B2325",
  line: "#334144",
  green: "#B4F272",
  muted: "#9CAEB0",
  white: "#F4F8F5",
  night: "#AFB7FF",
  day: "#F3CD87",
};
type Props = {
  now: number;
  shift: Shift;
  shifts: Shift[];
  timer: Timer | null;
  project?: string;
  busy: boolean;
  priorMinutes?: number;
  onSelect: (shift: Shift) => void;
  onEdit: () => void;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onStartAt: () => void;
};
function Icon({
  name,
  color: ink = color.muted,
  size = 20,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  color?: string;
  size?: number;
}) {
  return (
    <Ionicons
      name={name}
      color={ink}
      size={size}
      accessible={false}
      aria-hidden
    />
  );
}
function Action({
  label,
  icon,
  onPress,
  primary = false,
  disabled = false,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: primary ? color.green : "#2D393C",
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Icon name={icon} color={primary ? color.bg : color.white} />
      <Text
        style={[
          styles.actionLabel,
          { color: primary ? color.bg : color.white },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export default function ShiftClock(p: Props) {
  const active = p.timer,
    shift = active?.shift ?? p.shift,
    worked = active ? timerMinutes(active, p.now) : 0,
    norm =
      (active?.shift?.normHours ?? active?.dailyHours ?? shift.normHours) * 60;
  const progressMinutes = worked + (p.priorMinutes ?? 0);
  const seconds = Math.max(0, Math.floor(worked * 60));
  const elapsed = `${Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const planned = active
    ? active.plannedEnd
    : shift.autoStop
      ? shiftEnd(shift, p.now)
      : undefined;
  const accent = shift.kind === "night" ? color.night : color.day;
  return (
    <View
      style={[styles.card, { borderColor: active ? "#6F9448" : color.line }]}
    >
      <View style={styles.between}>
        <View style={{ gap: 6 }}>
          <Text style={styles.overline}>ZEGAR W PRACY</Text>
          <Text accessibilityLabel="Aktualna godzina" style={styles.wallClock}>
            {new Date(p.now).toLocaleTimeString("pl-PL", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ustawienia wybranej zmiany"
          onPress={p.onEdit}
          style={styles.settings}
        >
          <Icon name="options-outline" color={color.white} />
        </Pressable>
      </View>
      {!active && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.choices}
        >
          {p.shifts.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`Wybierz zmianę: ${s.name}`}
              accessibilityState={{ selected: s.id === p.shift.id }}
              disabled={p.busy}
              onPress={() => p.onSelect(s)}
              style={[
                styles.choice,
                s.id === p.shift.id && {
                  backgroundColor: "#39433E",
                  borderColor: color.green,
                },
              ]}
            >
              <Icon
                name={s.kind === "night" ? "moon-outline" : "sunny-outline"}
                color={s.id === p.shift.id ? color.green : color.muted}
                size={17}
              />
              <Text
                style={{
                  color: s.id === p.shift.id ? color.white : color.muted,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {s.name === "Zmiana dzienna"
                  ? "Dzienna"
                  : s.name === "Zmiana nocna"
                    ? "Nocna"
                    : s.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {active && !active.shift ? (
        <View style={[styles.schedule, { marginTop: 12, gap: 7 }]}>
          <Text style={{ color: color.white, fontSize: 13, fontWeight: "600" }}>
            Licznik z poprzedniej wersji
          </Text>
          <Text style={[styles.small, { lineHeight: 18 }]}>
            Zachowuje poprzednie reguły dzienne. Po zakończeniu wybierzesz
            zmianę dzienną lub nocną.
          </Text>
        </View>
      ) : (
        <View style={[styles.schedule, { marginTop: active ? 20 : 0 }]}>
          <View style={styles.between}>
            <View style={styles.row}>
              <Icon
                name={shift.kind === "night" ? "moon" : "sunny"}
                color={accent}
                size={17}
              />
              <Text style={{ color: accent, fontSize: 12, fontWeight: "600" }}>
                {shift.name}
              </Text>
            </View>
            <Text style={styles.norm}>Norma {duration(norm)} h</Text>
          </View>
          <View
            style={[styles.between, { marginTop: 12, alignItems: "flex-end" }]}
          >
            <Text style={styles.hours}>
              {shift.startTime} <Text style={{ color: "#778A8D" }}>—</Text>{" "}
              {shift.endTime}
            </Text>
            {shift.endTime < shift.startTime && (
              <Text style={styles.nextDay}>+1 dzień</Text>
            )}
          </View>
        </View>
      )}
      <View style={{ paddingVertical: active ? 16 : 10, gap: 7 }}>
        <View style={styles.row}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: active
                  ? active.pausedAt === null
                    ? color.green
                    : color.night
                  : "#738385",
              },
            ]}
          />
          <Text style={styles.overline}>
            {active
              ? active.pausedAt === null
                ? "W TRAKCIE PRACY"
                : "CZAS NA PRZERWĘ"
              : "GOTOWY DO STARTU"}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.small, { marginLeft: "auto", flexShrink: 1 }]}
          >
            {p.project ?? "Wybierz projekt"}
          </Text>
        </View>
        {active && (
          <Text
            accessibilityLabel="Czas pracy"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={styles.elapsed}
          >
            {elapsed}
          </Text>
        )}
        <View style={styles.track}>
          <View
            style={{
              width: `${Math.min(100, (progressMinutes / norm) * 100)}%`,
              height: 5,
              backgroundColor: color.green,
              borderRadius: 5,
            }}
          />
        </View>
        <View style={styles.between}>
          <Text style={styles.small}>
            {progressMinutes < norm
              ? `Do normy ${duration(norm - progressMinutes)} h`
              : `Ponad normę ${duration(progressMinutes - norm)} h`}
          </Text>
          <Text style={styles.small}>
            {(p.priorMinutes ?? 0) > 0
              ? `Wcześniej ${duration(p.priorMinutes!)} h tej zmiany`
              : active
                ? "Przerwy nie wliczają się do normy"
                : "Start zapisuje rzeczywisty czas przyjścia"}
          </Text>
        </View>
      </View>
      {active ? (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Action
              label={active.pausedAt === null ? "Przerwa" : "Wznów"}
              icon={active.pausedAt === null ? "pause" : "play"}
              onPress={p.onPause}
              disabled={p.busy}
            />
          </View>
          <View style={{ flex: 1.3 }}>
            <Action
              label="Zakończ zmianę"
              icon="stop"
              onPress={p.onStop}
              primary
              disabled={p.busy}
            />
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Action
              label={p.project ? "Start zmiany" : "Dodaj projekt"}
              icon="play"
              onPress={p.onStart}
              disabled={p.busy}
              primary
            />
          </View>
          {p.project && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Rozpocznij od wybranej godziny"
              onPress={p.onStartAt}
              disabled={p.busy}
              style={styles.startAt}
            >
              <Icon name="time-outline" color={color.white} />
            </Pressable>
          )}
        </View>
      )}
      <View style={styles.footer}>
        <Icon
          name={planned ? "alarm-outline" : "hand-left-outline"}
          color={planned ? color.green : color.muted}
          size={16}
        />
        <Text style={[styles.small, { flex: 1, lineHeight: 18 }]}>
          {planned
            ? `Auto-stop ${dateKey(planned) === dateKey(p.now) ? "dzisiaj" : dateKey(planned)} o ${timeLabel(planned)}. Kolejną zmianę uruchomisz samodzielnie.`
            : "Zakończ zmianę przyciskiem Stop. Kolejny start dopiero wtedy, gdy wrócisz do pracy."}
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: color.card,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 9 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  overline: {
    color: color.muted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  wallClock: {
    fontSize: 25,
    color: color.white,
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
    fontWeight: "500",
  },
  settings: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#2D393C",
    justifyContent: "center",
    alignItems: "center",
  },
  choices: { gap: 9, paddingVertical: 11 },
  choice: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  schedule: {
    borderRadius: 15,
    padding: 12,
    backgroundColor: "#141C1F",
    borderWidth: 1,
    borderColor: "#2D3A3E",
  },
  norm: { color: color.muted, fontSize: 11 },
  hours: {
    fontSize: 24,
    fontWeight: "600",
    color: color.white,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.6,
  },
  nextDay: { color: color.muted, fontSize: 10, paddingBottom: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  small: { fontSize: 10, color: color.muted },
  elapsed: {
    fontSize: 46,
    color: color.white,
    fontWeight: "300",
    fontVariant: ["tabular-nums"],
    letterSpacing: -2,
    marginVertical: 4,
  },
  track: {
    height: 5,
    backgroundColor: "#35423C",
    borderRadius: 5,
    overflow: "hidden",
    marginVertical: 5,
  },
  action: {
    minHeight: 50,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 10,
  },
  actionLabel: { fontSize: 14, fontWeight: "700" },
  startAt: {
    height: 50,
    width: 48,
    borderRadius: 14,
    backgroundColor: "#2D393C",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
    borderTopWidth: 1,
    borderColor: color.line,
    paddingTop: 12,
    marginTop: 12,
  },
});
