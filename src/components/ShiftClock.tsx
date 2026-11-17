import {
  Pressable,
  Text,
  View,
  usePresentation,
  Icon as Ionicons,
} from "../ui";
import React from "react";
import { StyleSheet } from "react-native";
import {
  dateKey,
  duration as formatDuration,
  shiftEnd,
  timerMinutes,
  timerWeekMinutes,
  type Job,
  timeLabel,
  type Shift,
  type Timer,
} from "../domain";
const color = {
  bg: "#111214",
  card: "#1C1D20",
  line: "#34363C",
  green: "#DCE2EA",
  muted: "#A0A3AB",
  white: "#F4F4F5",
  night: "#9DAAC0",
  day: "#C7C9CD",
};
type Props = {
  timeFormat?: "clock" | "decimal";
  now: number;
  shift: Shift;
  timer: Timer | null;
  project?: string;
  busy: boolean;
  priorMinutes?: number;
  priorWeeklyMinutes?: number;
  policy?: Job;
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
          backgroundColor: primary ? color.green : "#2C2E33",
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
  const { language, locale } = usePresentation();
  const duration = (minutes: number) =>
    formatDuration(minutes, p.timeFormat, language);
  const active = p.timer,
    shift = active?.shift ?? p.shift,
    worked = active ? timerMinutes(active, p.now) : 0,
    shiftNorm =
      (active?.shift?.normHours ?? active?.dailyHours ?? shift.normHours) * 60;
  const mode = active
    ? (active.overtimeThreshold ?? "shift")
    : (p.policy?.overtimeThreshold ?? "shift");
  const weekNorm = (active?.weeklyHours ?? p.policy?.weeklyHours ?? 40) * 60;
  const shiftMinutes = worked + (p.priorMinutes ?? 0);
  const weekMinutes =
    (p.priorWeeklyMinutes ?? 0) +
    (active ? timerWeekMinutes(active, p.now) : 0);
  const useWeek =
    mode === "week" ||
    (mode === "both" && weekNorm - weekMinutes < shiftNorm - shiftMinutes);
  const norm = useWeek ? weekNorm : shiftNorm;
  const progressMinutes = useWeek ? weekMinutes : shiftMinutes;
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
      style={[styles.card, { borderColor: active ? "#9CA7B8" : color.line }]}
    >
      <View style={styles.between}>
        <View style={{ gap: 6 }}>
          <Text style={styles.overline}>ZEGAR W PRACY</Text>
          <Text accessibilityLabel="Aktualna godzina" style={styles.wallClock}>
            {new Date(p.now).toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wybierz zmianę w ustawieniach"
          onPress={p.onEdit}
          style={styles.settings}
        >
          <Icon name="options-outline" color={color.white} />
        </Pressable>
      </View>
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
            <Text style={styles.norm}>
              {mode === "week" ? "Norma tygodnia" : "Norma zmiany"}{" "}
              {duration(mode === "week" ? weekNorm : shiftNorm)} h
            </Text>
          </View>
          <View
            style={[styles.between, { marginTop: 12, alignItems: "flex-end" }]}
          >
            <Text style={styles.hours}>
              {shift.startTime} <Text style={{ color: "#92969F" }}>—</Text>{" "}
              {shift.endTime}
            </Text>
            {shift.endTime < shift.startTime && (
              <Text style={styles.nextDay}>+1 dzień</Text>
            )}
          </View>
        </View>
      )}
      {mode !== "shift" && (
        <Text style={[styles.small, { marginTop: 10 }]}>
          {"Tydzień"}: {duration(weekMinutes)} / {duration(weekNorm)} h ·{" "}
          {mode === "both" ? "Oba progi" : "Próg tygodniowy"}
        </Text>
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
                  : "#81848C",
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
            verbatim
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
        <View style={[styles.between, { flexWrap: "wrap" }]}>
          <Text style={styles.small}>
            {progressMinutes < norm
              ? `Do nadgodzin ${duration(norm - progressMinutes)} h`
              : "Nadgodziny aktywne"}
          </Text>
          <Text style={styles.small}>
            {(p.priorMinutes ?? 0) >= 1
              ? `Wcześniej ${duration(p.priorMinutes!)} h tej zmiany`
              : active
                ? "Przerwy nie wliczają się do normy"
                : "Start zapisuje czas przyjścia"}
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
              <Text style={styles.startAtLabel}>Godzina</Text>
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
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
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
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  wallClock: {
    fontSize: 25,
    color: color.white,
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
    fontWeight: "500",
  },
  settings: {
    width: 48,
    height: 48,
    borderRadius: 13,
    backgroundColor: "#2C2E33",
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
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#17181B",
    borderWidth: 1,
    borderColor: "#34363C",
  },
  norm: { color: color.muted, fontSize: 12 },
  hours: {
    fontSize: 24,
    fontWeight: "600",
    color: color.white,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.6,
  },
  nextDay: { color: color.muted, fontSize: 11, paddingBottom: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  small: { fontSize: 12, lineHeight: 18, color: color.muted },
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
    backgroundColor: "#34363C",
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
    minWidth: 76,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "#2C2E33",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  startAtLabel: { color: color.white, fontSize: 10, fontWeight: "600" },
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
