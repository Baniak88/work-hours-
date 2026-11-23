import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  usePresentation,
  Icon as Ionicons,
} from "../ui";
import React, { useMemo, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  Break,
  Entry,
  Holiday,
  holidayDates,
  Job,
  overtimeHourlyRate,
  extraHourlyRate,
  parseWeeklyNormHours,
  overtimePercentInput,
  policyOvertimePercent,
  parseNormHours,
  allowanceHourlyRate,
  overtimeSnapshot,
  validateOvertime,
  State,
  Shift,
  Slice,
  makeTimer,
  priorShiftBreakMilliseconds,
  adjustTimerStart,
  shiftWorkDate,
  validateShift,
  calculate,
  groupSlices,
  previewSlices,
  updateActiveWeeklyPolicy,
  setWeeklyTarget,
  setWeeklyBalance,
  parseWeeklyBalance,
  weeklyCorrectionMinutes,
  weekHolidayMinutes,
  thresholdCorrections,
  checkEntry,
  findEntryConflicts,
  csv,
  dateKey,
  demoState,
  duration as formatDuration,
  formatCountdown,
  timerMinutes,
  finishShift,
  finishShiftAt,
  syncTimerBreakContext,
  localDate,
  minutesWorked,
  money,
  parseLocal,
  timeLabel,
  totals,
  uid,
  validateBackup,
  weekKey,
} from "../domain";
import { useWorkHours } from "../WorkHoursProvider";
import { router } from "expo-router";
import {
  clearWorkData,
  removeSampleData,
  sampleEntryIds,
  removeJobData,
} from "../dataManagement";
import InstallHelp from "../components/InstallHelp";
import { dashboardWeek } from "../dashboardWeek";
import WorkCalendar from "../components/WorkCalendar";
import DatePicker from "../components/DatePicker";
import { manualDates, moveManualDay, previousLocalDay } from "../manualEntry";
import { exportFile, importFile } from "../files";
import { finishTimeInput, typeTimeInput } from "../timeInput";
import { heroes, isLightTheme } from "../themes";

// Same artwork as the app icon, so the in-app logo matches the home screen.
const logoMark = require("../../assets/logo-mark.png");
const C = {
  bg: "#111214",
  card: "#1C1D20",
  raised: "#282A2F",
  line: "#34363C",
  text: "#F4F4F5",
  muted: "#A0A3AB",
  green: "#DCE2EA",
  blue: "#AEBED1",
  red: "#ECAAA5",
};

type Icon = React.ComponentProps<typeof Ionicons>["name"];
type Tab = "home" | "entries" | "reports" | "settings";
type Form = {
  type:
    | "job"
    | "entry"
    | "start"
    | "shift"
    | "adjust"
    | "stopAt"
    | "holiday"
    | "holidaySettings"
    | "weeklyNorm"
    | "weekBalance"
    | "breakSettings";
  id?: string;
  [key: string]: string | undefined;
};
type Confirm = {
  title: string;
  body: string;
  label: string;
  action: () => void;
  danger?: boolean;
};
const tabs: { key: Tab; label: string; icon: Icon }[] = [
  { key: "home", label: "Pulpit", icon: "grid-outline" },
  { key: "entries", label: "Kalendarz", icon: "calendar-outline" },
  { key: "reports", label: "Raporty", icon: "stats-chart-outline" },
  { key: "settings", label: "Ustawienia", icon: "options-outline" },
];
function I({
  name,
  size = 20,
  color = C.muted,
}: {
  name: Icon;
  size?: number;
  color?: string;
}) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      accessible={false}
      aria-hidden={true}
    />
  );
}
function Button({
  label,
  onPress,
  icon,
  kind = "primary",
  disabled = false,
  small = false,
}: {
  label: string;
  onPress: () => void;
  icon?: Icon;
  kind?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        small && s.smallButton,
        kind === "primary"
          ? s.primary
          : kind === "danger"
            ? { backgroundColor: "#452A29" }
            : kind === "ghost"
              ? s.outlineButton
              : s.secondary,
        { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      {icon && (
        <I
          name={icon}
          color={
            kind === "primary"
              ? C.bg
              : kind === "danger"
                ? C.red
                : kind === "ghost"
                  ? C.green
                  : C.text
          }
          size={small ? 16 : 20}
        />
      )}
      <Text
        style={[
          s.buttonText,
          small && { fontSize: 12 },
          {
            color:
              kind === "primary"
                ? C.bg
                : kind === "danger"
                  ? C.red
                  : kind === "ghost"
                    ? C.green
                    : C.text,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
function Chip({
  label,
  active,
  onPress,
  dot,
  verbatim = false,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  dot?: string;
  verbatim?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[s.chip, active && s.chipActive]}
    >
      {dot && <View style={[s.dot, { backgroundColor: dot }]} />}
      <Text
        verbatim={verbatim}
        style={{
          color: active ? C.text : C.muted,
          fontSize: 13,
          fontWeight: active ? "600" : "400",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  numeric = false,
  multiline = false,
  time = false,
  onBlur,
}: {
  label: string;
  value?: string;
  onChange: (s: string) => void;
  placeholder?: string;
  numeric?: boolean;
  multiline?: boolean;
  /** Hours field: "17.45" or "1745" is turned into "17:45". */
  time?: boolean;
  onBlur?: () => void;
}) {
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value ?? ""}
        onChangeText={time ? (v) => onChange(typeTimeInput(v)) : onChange}
        onBlur={() => {
          if (time && value) {
            const finished = finishTimeInput(value);
            if (finished !== value) onChange(finished);
          }
          onBlur?.();
        }}
        placeholder={placeholder}
        placeholderTextColor="#7F838D"
        keyboardType={numeric || time ? "decimal-pad" : "default"}
        multiline={multiline}
        style={[s.input, multiline && { height: 85, textAlignVertical: "top" }]}
        autoCapitalize="none"
      />
    </View>
  );
}
function Empty({
  icon = "calendar-outline",
  title,
  body,
  action,
}: {
  icon?: Icon;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <I name={icon} color={C.green} size={28} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
      {action}
    </View>
  );
}
export default function WorkHoursScreen({ tab }: { tab: Tab }) {
  const {
    state,
    loadError,
    load,
    now,
    busy,
    notice,
    setNotice,
    selected,
    setSelected,
    save,
  } = useWorkHours();
  const { language, locale, theme, t: tr } = usePresentation();
  const lightTheme = isLightTheme(theme);
  const hero = heroes[theme];
  const heroBackground = {
    backgroundColor: hero.from,
    backgroundImage: `linear-gradient(160deg, ${hero.from} 0%, ${hero.to} 100%)`,
  } as const;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 850;
  const paths = {
    home: "/",
    entries: "/entries",
    reports: "/reports",
    settings: "/settings",
  } as const;
  function setTab(next: Tab) {
    router.replace(paths[next]);
  }
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [form, setForm] = useState<Form | null>(null),
    [formError, setFormError] = useState(""),
    [confirm, setConfirm] = useState<Confirm | null>(null),
    [preferencesOpen, setPreferencesOpen] = useState(false),
    [managementOpen, setManagementOpen] = useState(false),
    [payDetailsOpen, setPayDetailsOpen] = useState(false),
    [dashboardWeekOffset, setDashboardWeekOffset] = useState(0);
  const [search, setSearch] = useState(""),
    [projectFilter, setProjectFilter] = useState("all"),
    [shiftFilter, setShiftFilter] = useState("all"),
    [group, setGroup] = useState<"days" | "weeks" | "months" | "jobs">("weeks"),
    [period, setPeriod] = useState("all"),
    [reportMode, setReportMode] = useState<"summary" | "payments">("summary");
  const [entryView, setEntryView] = useState<"calendar" | "list">("calendar"),
    [showFilters, setShowFilters] = useState(false),
    [calendarDate, setCalendarDate] = useState(() => dateKey(now)),
    [calendarMonth, setCalendarMonth] = useState(() =>
      dateKey(now).slice(0, 7),
    );
  const samples = useMemo(
    () => (state ? sampleEntryIds(state) : new Set<string>()),
    [state],
  );
  const stateCorrections = state?.balanceCorrections,
    stateHolidays = state?.holidays,
    stateJobs = state?.jobs;
  const corrections = useMemo(
    () =>
      thresholdCorrections({
        balanceCorrections: stateCorrections ?? [],
        holidays: stateHolidays ?? [],
        jobs: stateJobs ?? [],
      }),
    [stateCorrections, stateHolidays, stateJobs],
  );
  const calculated = useMemo(
    () =>
      groupSlices(
        calculate(
          state?.entries ?? [],
          state?.weekBoundary ?? "midnight",
          corrections,
        ),
        state?.countingMode ?? "shift",
      ),
    [state?.entries, state?.countingMode, state?.weekBoundary, corrections],
  );
  const liveCalculated = useMemo(
    () =>
      state?.timer && tab === "home"
        ? groupSlices(
            previewSlices(
              state.entries,
              state.timer,
              now,
              state.weekBoundary ?? "midnight",
              corrections,
            ),
            state.countingMode ?? "shift",
          )
        : calculated,
    [state, now, tab, calculated, corrections],
  );
  if (!state)
    return (
      <View style={[s.app, { justifyContent: "center", padding: 30 }]}>
        <StatusBar style="light" />
        {loadError ? (
          <>
            <I name="warning-outline" color={C.red} size={32} />
            <Text style={[s.emptyBody, { marginVertical: 20 }]}>
              {loadError}
            </Text>
            <Button label="Spróbuj ponownie" onPress={() => void load()} />
          </>
        ) : (
          <ActivityIndicator color={C.green} />
        )}
      </View>
    );
  const data = state,
    jobs = data.jobs.filter((j) => !j.archived),
    job = jobs.find((j) => j.id === selected) ?? jobs[0],
    timer = data.timer;
  const shift = data.shifts.find((x) => x.id === data.preferredShiftId)!;
  const slices = calculated,
    week = weekKey(now),
    month = dateKey(now).slice(0, 7),
    today = dateKey(now),
    weekSlices = slices.filter((x) => weekKey(localDate(x.weekDate)) === week),
    monthSlices = slices.filter((x) => x.date.startsWith(month)),
    ws = totals(weekSlices),
    ms = totals(monthSlices);
  const total = totals(slices);
  const fmt = (n: number) => money(n, data.currency);
  const duration = (minutes: number) =>
    formatDuration(minutes, data.timeFormat, language);
  const jobFor = (id: string) => data.jobs.find((j) => j.id === id)!;
  function openJob(j?: Job) {
    setFormError("");
    setForm({
      type: "job",
      id: j?.id,
      name: j?.name ?? tr("Moja praca"),
      rate: j ? String(j.rate) : "",
      dailyHours: String(j?.dailyHours ?? 8),
      overtime: String(j?.overtime ?? 1.25),
      overtimeMode: "multiplier",
      overtimePercent: j ? String(policyOvertimePercent(j) ?? "") : "150",
      shiftAllowancePercent: String(j?.shiftAllowancePercent ?? 0),
      overtimeBase: j?.overtimeBase ?? "basic",
      overtimeThreshold: "week",
      weeklyNorm: formatDuration((j?.weeklyHours ?? 40) * 60),
      color: j?.color ?? C.green,
    });
  }
  function openWeeklyNorm(j?: Job, recalculateHistory = false) {
    if (!j) {
      openJob();
      return;
    }
    const current = timer?.jobId === j.id ? timer : j;
    setFormError("");
    setForm({
      type: "weeklyNorm",
      id: j.id,
      weeklyNorm: formatDuration((current.weeklyHours ?? 40) * 60),
      overtimeThreshold: "week",
      recalculateHistory: String(recalculateHistory),
    });
  }
  function updateRate(key: string, value: string) {
    setForm((f) =>
      f
        ? {
            ...f,
            [key]: value,
            ...(f.type === "entry" ? { ratesDirty: "true" } : {}),
          }
        : f,
    );
  }
  function payOptions(f: Form) {
    const threshold = (
      f.type === "entry" && f.id ? (f.overtimeThreshold ?? "shift") : "week"
    ) as "shift" | "week" | "both";
    let weeklyHours = 40;
    try {
      weeklyHours = parseWeeklyNormHours(f.weeklyNorm ?? "40:00");
    } catch (error) {
      if (threshold !== "shift") throw error;
    }
    return {
      ...(f.overtimeBase === "legacy"
        ? {}
        : {
            overtimeBase: (f.overtimeBase ?? "basic") as
              "basic" | "withAllowance",
          }),
      allowanceOnOvertime: f.overtimeBase === "legacy",
      overtimeThreshold: threshold,
      weeklyHours,
    };
  }
  function rateFields() {
    if (!form) return null;
    const base = Number(form.rate?.replace(",", ".")),
      percent = Number(form.shiftAllowancePercent?.replace(",", ".")),
      overtimePercent = (() => {
        try {
          return overtimePercentInput(form.overtimePercent ?? "");
        } catch {
          return NaN;
        }
      })(),
      overtime = extraHourlyRate({
        rate: base,
        overtime: overtimePercent / 100,
        shiftAllowancePercent: percent,
        ...(form.overtimeBase === "legacy"
          ? {}
          : {
              overtimeBase:
                form.overtimeBase === "withAllowance"
                  ? ("withAllowance" as const)
                  : ("basic" as const),
            }),
        allowanceOnOvertime: form.overtimeBase === "legacy",
      }),
      allowance = (base * percent) / 100;
    return (
      <View style={{ gap: 14 }}>
        <Field
          label={`Basic — stawka podstawowa (${data.currency}/h)`}
          numeric
          value={form.rate}
          onChange={(v) => updateRate("rate", v)}
          placeholder="np. 20,00"
        />
        <Field
          label="Shift allowance — dodatek (%)"
          numeric
          value={form.shiftAllowancePercent}
          onChange={(v) => updateRate("shiftAllowancePercent", v)}
          placeholder="np. 15"
        />
        <Text style={s.caption}>
          Procent stawki Basic. Wpisz 0, jeśli nie masz dodatku.
        </Text>
        <Text style={s.fieldLabel}>Podstawa nadgodzin</Text>
        <View style={[s.row, { flexWrap: "wrap" }]}>
          <Chip
            label="Samo Basic"
            active={form.overtimeBase === "basic"}
            onPress={() => updateRate("overtimeBase", "basic")}
          />
          <Chip
            label="Basic + dodatek"
            active={form.overtimeBase === "withAllowance"}
            onPress={() => updateRate("overtimeBase", "withAllowance")}
          />
          {form.overtimeBase === "legacy" && (
            <Chip label="Dotychczasowy sposób" active onPress={() => {}} />
          )}
        </View>
        {form.overtimeBase === "legacy" && (
          <Text style={s.caption}>
            Stary zapis: Basic × procent + niepomnożony dodatek. Wybierz Samo
            Basic lub Basic + dodatek, aby zmienić zasadę.
          </Text>
        )}
        <Field
          label="Overtime — procent wybranej podstawy (%)"
          numeric
          value={form.overtimePercent}
          onChange={(v) => updateRate("overtimePercent", v)}
          onBlur={() => {
            try {
              const percent = String(
                overtimePercentInput(form.overtimePercent ?? ""),
              );
              if (percent !== form.overtimePercent)
                updateRate("overtimePercent", percent);
            } catch {
              /* Submit shows validation without interrupting typing. */
            }
          }}
          placeholder="150 lub 1,5"
        />
        <Text style={s.caption}>
          150% = ×1,5 wybranej podstawy. Skrót 1,5 oznacza to samo co 150%.
        </Text>
        <View style={[s.row, { flexWrap: "wrap" }]}>
          {[125, 150, 200].map((percent) => (
            <Chip
              key={percent}
              label={`${percent}%`}
              active={overtimePercent === percent}
              onPress={() => updateRate("overtimePercent", String(percent))}
            />
          ))}
        </View>
        {(form.type !== "entry" ||
          !form.id ||
          form.overtimeThreshold !== "shift") && (
          <>
            <Field
              label="Tygodniowa norma (godziny:minuty)"
              value={form.weeklyNorm}
              placeholder="40:00"
              time
              onChange={(value) => updateRate("weeklyNorm", value)}
            />
            <Text style={s.caption}>
              Poniedziałek–niedziela, osobno dla tego miejsca pracy. Liczą się
              wszystkie płatne godziny; przerwy są odliczane.
            </Text>
          </>
        )}
        <View
          style={{
            padding: 14,
            gap: 10,
            backgroundColor: C.raised,
            borderRadius: 12,
          }}
        >
          <View style={s.between}>
            <Text style={s.caption}>Do normy · Basic + dodatek</Text>
            <Text style={s.rowTitle}>
              {form.rate?.trim() && Number.isFinite(base + allowance)
                ? fmt(base + allowance)
                : "—"}
              /h
            </Text>
          </View>
          <View style={s.between}>
            <Text style={s.caption}>Po normie · Overtime</Text>
            <Text style={s.rowTitle}>
              {form.rate?.trim() && Number.isFinite(overtime)
                ? fmt(overtime)
                : "—"}
              /h
            </Text>
          </View>
        </View>
        <Text style={s.caption}>
          {form.type === "entry" && form.id && form.overtimeThreshold !== "week"
            ? "Ten wcześniejszy wpis zachowuje swoją zapisaną zasadę nadgodzin."
            : "Nadgodziny dopiero po tygodniowej normie. Norma pojedynczej zmiany nie uruchamia nadgodzin."}
        </Text>
      </View>
    );
  }
  function selectEntryJob(id: string) {
    const j = jobFor(id);
    setForm((f) =>
      f
        ? {
            ...f,
            jobId: id,
            rate: String(j.rate),
            overtime: String(j.overtime),
            overtimeMode: "multiplier",
            shiftAllowancePercent: String(j.shiftAllowancePercent ?? 0),
            overtimeBase:
              j.overtimeBase ?? (j.allowanceOnOvertime ? "legacy" : "basic"),
            overtimeThreshold: j.overtimeThreshold ?? "shift",
            weeklyNorm: formatDuration((j.weeklyHours ?? 40) * 60),
            overtimePercent: String(policyOvertimePercent(j) ?? ""),
            ratesExpanded: "false",
            ratesDirty: "false",
          }
        : f,
    );
  }
  function openShift(value?: Shift) {
    setFormError("");
    setForm({
      type: "shift",
      id: value?.id,
      name: value?.name ?? "",
      kind: value?.kind ?? "day",
      startTime: value?.startTime ?? "06:00",
      endTime: value?.endTime ?? "14:00",
      normHours: formatDuration((value?.normHours ?? 8) * 60),
      autoStop: String(value?.autoStop ?? false),
    });
  }
  function selectFormShift(id: string) {
    setForm((f) => {
      if (!f) return f;
      const selectedShift = data.shifts.find((x) => x.id === id);
      if (!selectedShift || f.type !== "entry") return { ...f, shiftId: id };
      const day = f.startDate ?? dateKey(now);
      let endDay = day;
      if (selectedShift.endTime < selectedShift.startTime) {
        const d = localDate(day);
        d.setDate(d.getDate() + 1);
        endDay = dateKey(d);
      }
      return {
        ...f,
        shiftId: id,
        startTime: selectedShift.startTime,
        endTime: selectedShift.endTime,
        endDate: endDay,
        endDateEdited: "false",
      };
    });
  }
  function openEntry(e?: Entry, onDate?: string) {
    // eslint-disable-next-line react-hooks/purity -- Read on a button press, never while rendering the nested screen helpers.
    const timestamp = Date.now();
    let end = e?.end ?? timestamp,
      start = e?.start ?? end - 8 * 3600000;
    if (!e && onDate) {
      start = parseLocal(onDate, shift.startTime);
      const endDate = localDate(onDate);
      if (shift.endTime < shift.startTime)
        endDate.setDate(endDate.getDate() + 1);
      end = Math.min(parseLocal(dateKey(endDate), shift.endTime), timestamp);
      if (start >= end)
        start = Math.max(parseLocal(onDate, "00:00"), end - 3600000);
    }
    const entryPolicy = e ?? job;

    setFormError("");
    setForm({
      type: "entry",
      id: e?.id,
      jobId: e?.jobId ?? job?.id ?? "",
      shiftId: e ? (e.shift?.id ?? "legacy") : data.preferredShiftId,
      startDate: dateKey(start),
      startTime: timeLabel(start),
      endDate: dateKey(end),
      endTime: timeLabel(end),
      breakMinutes: String(
        e
          ? Math.round(
              (e.end - e.start) / 60000 -
                minutesWorked(e.start, e.end, e.breaks),
            )
          : data.defaultBreakMinutes,
      ),
      endDateEdited: e ? "true" : "false",
      note: e?.note ?? "",
      rate: String(entryPolicy?.rate ?? 0),
      overtime: String(entryPolicy?.overtime ?? 1.25),
      overtimeMode: "multiplier",
      shiftAllowancePercent: String(entryPolicy?.shiftAllowancePercent ?? 0),
      overtimeBase:
        entryPolicy?.overtimeBase ??
        (entryPolicy?.allowanceOnOvertime ? "legacy" : "basic"),
      overtimeThreshold: entryPolicy?.overtimeThreshold ?? "shift",
      weeklyNorm: formatDuration((entryPolicy?.weeklyHours ?? 40) * 60),
      overtimePercent: entryPolicy
        ? String(policyOvertimePercent(entryPolicy) ?? "")
        : "150",
      ratesExpanded: "false",
      ratesDirty: "false",
    });
  }
  function openStart() {
    setFormError("");
    setForm({
      type: "start",
      jobId: job?.id ?? "",
      shiftId: data.preferredShiftId,
      startDate: dateKey(now),
      startTime: timeLabel(now),
    });
  }
  function selectManualDate(day: string) {
    setFormError("");
    setForm((f) => {
      if (!f || f.type !== "entry") return f;
      const selectedShift =
        data.shifts.find((x) => x.id === f.shiftId) ?? shift;
      try {
        return {
          ...f,
          ...manualDates(day, selectedShift),
          endDateEdited: "false",
        };
      } catch {
        return { ...f, startDate: day };
      }
    });
  }
  function editManualStartDate(value: string) {
    setFormError("");
    setForm((f) => {
      if (!f || f.type !== "entry") return f;
      if (f.endDateEdited === "true") return { ...f, startDate: value };
      const selectedShift =
        data.shifts.find((x) => x.id === f.shiftId) ?? shift;
      try {
        return { ...f, ...manualDates(value, selectedShift) };
      } catch {
        return { ...f, startDate: value };
      }
    });
  }
  function openAdjust() {
    if (!timer) return;
    setFormError("");
    setForm({
      type: "adjust",
      startDate: dateKey(timer.start),
      startTime: timeLabel(timer.start),
    });
  }
  function openBreakSettings() {
    setFormError("");
    setForm({
      type: "breakSettings",
      minutes: String(data.defaultBreakMinutes),
      automatic: String(data.automaticBreak),
    });
  }
  function openHoliday(value?: Holiday, selectedDate?: string) {
    const holidayDate = value?.date ?? selectedDate ?? calendarDate;
    setFormError("");
    setForm({
      type: "holiday",
      id: value?.id,
      date: holidayDate,
      days: "1",
      hours: formatDuration(
        (value?.hours ??
          data.holidaySettings?.[holidayDate.slice(0, 4)]?.hours ??
          shift.normHours) * 60,
      ),
      rate: String(
        value?.rate ??
          data.holidaySettings?.[holidayDate.slice(0, 4)]?.rate ??
          job?.rate ??
          0,
      ),
    });
  }
  function openHolidaySettings() {
    const year = calendarMonth.slice(0, 4),
      settings = data.holidaySettings?.[year];
    setFormError("");
    setForm({
      type: "holidaySettings",
      year,
      days: String(settings?.days ?? 28),
      rate: String(settings?.rate ?? job?.rate ?? 0),
      hours: formatDuration((settings?.hours ?? shift.normHours) * 60),
    });
  }
  async function start(
    // eslint-disable-next-line react-hooks/purity -- The custom clock's onStart event invokes this handler.
    at = Date.now(),
    id = job?.id,
    shiftId = data.preferredShiftId,
  ) {
    if (!id || timer) return;
    const j = jobFor(id);
    const selectedShift = data.shifts.find((x) => x.id === shiftId) ?? shift;
    const autoBreakMinutes = data.automaticBreak ? data.defaultBreakMinutes : 0;
    if (data.entries.some((e) => e.end > at)) {
      setFormError("Początek nakłada się na zapisaną zmianę.");
      setNotice("Początek nakłada się na zapisaną zmianę.");
      return;
    }
    if (
      await save(
        {
          ...data,
          timer: makeTimer(
            j,
            selectedShift,
            at,
            autoBreakMinutes,
            priorShiftBreakMilliseconds(
              data.entries,
              id,
              selectedShift,
              at,
              autoBreakMinutes,
            ),
          ),
        },
        "Licznik uruchomiony",
      )
    )
      setForm(null);
  }
  async function togglePause() {
    if (!timer) return;
    // eslint-disable-next-line react-hooks/purity -- Runs only when the Break/Resume tile is pressed.
    const at = Date.now();
    await save(
      {
        ...data,
        timer:
          timer.pausedAt === null
            ? { ...timer, pausedAt: at }
            : {
                ...timer,
                pausedAt: null,
                breaks: [...timer.breaks, { start: timer.pausedAt, end: at }],
              },
      },
      timer.pausedAt === null ? "Przerwa rozpoczęta" : "Wracasz do pracy",
    );
  }
  async function stop() {
    if (!timer) return;
    const end = Date.now();
    if (end <= timer.start) {
      setNotice("Poczekaj chwilę przed zakończeniem.");
      return;
    }
    const synchronized = syncTimerBreakContext(data);
    if (
      await save(
        finishShift(synchronized, synchronized.timer!, end),
        "Zmiana zapisana",
      )
    )
      setConfirm(null);
  }
  async function submit() {
    if (!form) return;
    setFormError("");
    try {
      if (form.type === "shift") {
        if (!form.id && data.shifts.length >= 100)
          throw new Error(
            "Możesz zapisać do 100 profili zmian. Edytuj istniejący profil.",
          );
        const value: Shift = {
          id: form.id ?? uid(),
          name: form.name?.trim() ?? "",
          kind: form.kind === "night" ? "night" : "day",
          startTime: form.startTime ?? "",
          endTime: form.endTime ?? "",
          normHours: parseNormHours(form.normHours ?? ""),
          autoStop: form.autoStop === "true",
        };
        validateShift(value);
        if (
          await save(
            {
              ...data,
              shifts: form.id
                ? data.shifts.map((x) => (x.id === value.id ? value : x))
                : [...data.shifts, value],
            },
            "Ustawienia zmiany zapisane",
          )
        )
          setForm(null);
        return;
      }
      if (form.type === "job") {
        const name = form.name?.trim() ?? "",
          rate = Number(form.rate?.replace(",", ".")),
          dailyHours = Number(form.dailyHours?.replace(",", ".")),
          overtime = overtimePercentInput(form.overtimePercent ?? "") / 100;
        const overtimePolicy = {
          overtimeMode: "multiplier" as const,
          shiftAllowancePercent: Number(
            form.shiftAllowancePercent?.replace(",", "."),
          ),
          ...payOptions(form),
        };
        validateOvertime(overtimePolicy);
        if (!name || name.length > 80)
          throw new Error("Podaj nazwę projektu (do 80 znaków).");
        if (
          !form.rate?.trim() ||
          !Number.isFinite(rate) ||
          rate < 0 ||
          rate > 100000
        )
          throw new Error("Podaj prawidłową stawkę od 0 do 100 000.");
        if (!Number.isFinite(dailyHours) || dailyHours <= 0 || dailyHours > 24)
          throw new Error("Dzienny limit musi wynosić od 0 do 24 godzin.");
        if (!Number.isFinite(overtime) || overtime < 1 || overtime > 10)
          throw new Error("Mnożnik nadgodzin musi wynosić od 1 do 10.");
        const j: Job = {
          id: form.id ?? uid(),
          name,
          rate,
          dailyHours,
          overtime,
          ...overtimePolicy,
          color: form.color ?? C.green,
          archived: data.jobs.find((j) => j.id === form.id)?.archived,
          demo: data.jobs.find((j) => j.id === form.id)?.demo,
        };
        if (
          await save(
            {
              ...data,
              jobs: form.id
                ? data.jobs.map((x) => (x.id === j.id ? j : x))
                : [...data.jobs, j],
              timer: updateActiveWeeklyPolicy(data.timer, j),
            },
            "Projekt zapisany",
          )
        ) {
          setSelected(j.id);
          setForm(null);
        }
        return;
      }
      if (form.type === "weekBalance") {
        const target = parseWeeklyBalance(form.balance ?? "");
        // eslint-disable-next-line react-hooks/purity -- Snapshot the user's correction at the save action.
        const asOf = Date.now();
        const next = setWeeklyBalance(
          data,
          form.jobId ?? "",
          form.week ?? "",
          target,
          asOf,
        );
        if (await save(next, "Stan godzin zaktualizowany")) setForm(null);
        return;
      }
      if (form.type === "weeklyNorm") {
        const currentJob = data.jobs.find((j) => j.id === form.id);
        if (!currentJob) throw new Error("Wybierz projekt.");
        const next = setWeeklyTarget(
          data,
          currentJob.id,
          parseWeeklyNormHours(form.weeklyNorm ?? ""),
          form.recalculateHistory === "true",
        );
        if (await save(next, "Norma tygodniowa zapisana")) setForm(null);
        return;
      }
      if (form.type === "breakSettings") {
        const minutes = Number(form.minutes);
        if (
          !form.minutes?.trim() ||
          !Number.isInteger(minutes) ||
          minutes < 0 ||
          minutes > 1440
        )
          throw new Error("Podaj liczbę minut od 0 do 1440.");
        if (
          await save(
            {
              ...data,
              defaultBreakMinutes: minutes,
              automaticBreak: form.automatic === "true",
            },
            "Ustawienia przerwy zapisane",
          )
        )
          setForm(null);
        return;
      }
      if (form.type === "stopAt") {
        if (!timer) throw new Error("Licznik nie jest uruchomiony.");
        const ending = parseLocal(form.endDate ?? "", form.endTime ?? "");
        // eslint-disable-next-line react-hooks/purity -- Read when the user saves the end time.
        const endedAt = Date.now();
        const synchronized = syncTimerBreakContext(data);
        if (
          await save(
            finishShiftAt(synchronized, synchronized.timer!, ending, endedAt),
            "Zmiana zapisana",
          )
        )
          setForm(null);
        return;
      }
      if (form.type === "adjust") {
        if (!timer) throw new Error("Licznik nie jest uruchomiony.");
        // eslint-disable-next-line react-hooks/purity -- This handler runs when the user saves the adjustment.
        const adjustedAt = Date.now();
        const original =
          dateKey(timer.start) === form.startDate &&
          timeLabel(timer.start) === form.startTime;
        const beginning = original
          ? timer.start
          : parseLocal(form.startDate ?? "", form.startTime ?? "");
        if (
          await save(
            {
              ...data,
              timer: adjustTimerStart(
                timer,
                beginning,
                data.entries,
                adjustedAt,
              ),
            },
            "Początek zmiany poprawiony",
          )
        )
          setForm(null);
        return;
      }
      if (form.type === "holiday") {
        const date = form.date ?? "";
        parseLocal(date, "12:00");
        const hours = parseNormHours(form.hours ?? "");
        const rate = Number(form.rate?.replace(",", "."));
        if (
          !form.rate?.trim() ||
          !Number.isFinite(rate) ||
          rate < 0 ||
          rate > 100000
        )
          throw new Error("Podaj prawidłową stawkę od 0 do 100 000.");
        const days = form.id ? 1 : Number(form.days);
        const dates = holidayDates(date, days);
        if (
          data.holidays.some((h) => dates.includes(h.date) && h.id !== form.id)
        )
          throw new Error("Urlop w tym dniu jest już zapisany.");
        const holiday = { id: form.id ?? uid(), date, hours, rate };
        if (
          await save(
            {
              ...data,
              holidays: form.id
                ? data.holidays.map((h) => (h.id === form.id ? holiday : h))
                : [
                    ...data.holidays,
                    ...dates.map((date) => ({ id: uid(), date, hours, rate })),
                  ],
            },
            "Urlop zapisany",
          )
        ) {
          setCalendarDate(date);
          setCalendarMonth(date.slice(0, 7));
          setForm(null);
        }
        return;
      }
      if (form.type === "holidaySettings") {
        const year = form.year ?? "",
          days = Number(form.days),
          rate = Number(form.rate?.replace(",", "."));
        if (
          !/^\d{4}$/.test(year) ||
          !form.days?.trim() ||
          !Number.isInteger(days) ||
          days < 0 ||
          days > 366
        )
          throw new Error("Podaj roczny limit od 0 do 366 dni.");
        if (
          !form.rate?.trim() ||
          !Number.isFinite(rate) ||
          rate < 0 ||
          rate > 100000
        )
          throw new Error("Podaj prawidłową stawkę od 0 do 100 000.");
        const hours = parseNormHours(form.hours ?? "");
        if (
          await save(
            {
              ...data,
              holidaySettings: {
                ...data.holidaySettings,
                [year]: { days, rate, hours },
              },
            },
            "Ustawienia urlopu zapisane",
          )
        )
          setForm(null);
        return;
      }
      const id = form.jobId;
      if (!id) throw new Error("Wybierz projekt.");
      const oldEntry = data.entries.find((e) => e.id === form.id);
      const parsedStart = parseLocal(
        form.startDate ?? "",
        form.startTime ?? "",
      );
      const startAt =
        oldEntry &&
        dateKey(oldEntry.start) === form.startDate &&
        timeLabel(oldEntry.start) === form.startTime
          ? oldEntry.start
          : parsedStart;
      if (form.type === "start") {
        // eslint-disable-next-line react-hooks/purity -- Submit handler: validate against the actual button-press time.
        if (startAt > Date.now())
          throw new Error("Początek pracy nie może być w przyszłości.");
        // eslint-disable-next-line react-hooks/purity -- Submit handler: validate against the actual button-press time.
        if (Date.now() - startAt > 7 * 86400000)
          throw new Error("Licznik można uruchomić do 7 dni wstecz.");
        await start(startAt, id, form.shiftId);
        return;
      }
      const parsedEnd = parseLocal(form.endDate ?? "", form.endTime ?? "");
      const end =
        oldEntry &&
        dateKey(oldEntry.end) === form.endDate &&
        timeLabel(oldEntry.end) === form.endTime
          ? oldEntry.end
          : parsedEnd;
      const breakMinutes = Number(form.breakMinutes?.replace(",", "."));
      if (!Number.isFinite(breakMinutes) || breakMinutes < 0)
        throw new Error("Podaj prawidłową długość przerwy.");
      const old = data.entries.find((e) => e.id === form.id),
        j = jobFor(id);
      const keepBreaks =
        old &&
        old.start === startAt &&
        old.end === end &&
        Math.round(
          (old.end - old.start) / 60000 -
            minutesWorked(old.start, old.end, old.breaks),
        ) === breakMinutes;
      const breaks: Break[] = keepBreaks
        ? old.breaks
        : breakMinutes
          ? [{ start: end - breakMinutes * 60000, end }]
          : [];
      const policy = old && old.jobId === id ? old : j;
      const entryPolicy =
        form.ratesDirty === "true"
          ? {
              rate: Number(form.rate?.replace(",", ".")),
              shiftAllowancePercent: Number(
                form.shiftAllowancePercent?.replace(",", "."),
              ),
              ...payOptions(form),
              overtime: overtimePercentInput(form.overtimePercent ?? "") / 100,
              overtimeMode: "multiplier" as const,
            }
          : policy;
      if (
        !Number.isFinite(entryPolicy.rate) ||
        entryPolicy.rate < 0 ||
        entryPolicy.rate > 100000
      )
        throw new Error("Podaj prawidłową stawkę godzinową.");
      if (
        !Number.isFinite(entryPolicy.overtime) ||
        entryPolicy.overtime < 1 ||
        entryPolicy.overtime > 10
      )
        throw new Error("Mnożnik musi wynosić od 1 do 10.");
      if (
        form.ratesDirty === "true" &&
        (!form.rate?.trim() || !form.overtimePercent?.trim())
      )
        throw new Error("Uzupełnij stawkę Basic i procent nadgodzin.");
      validateOvertime(entryPolicy);
      const entry: Entry = {
        id: form.id ?? uid(),
        jobId: id,
        start: startAt,
        end,
        breaks,
        ...(keepBreaks && old?.automaticBreaks
          ? { automaticBreaks: old.automaticBreaks }
          : {}),
        note: form.note?.trim() ?? "",
        rate: entryPolicy.rate,
        dailyHours: policy.dailyHours,
        overtime: entryPolicy.overtime,
        ...overtimeSnapshot(entryPolicy),
        ...(form.shiftId && form.shiftId !== "legacy"
          ? {
              shift:
                old?.shift?.id === form.shiftId
                  ? {
                      ...old.shift,
                      workDate: shiftWorkDate(old.shift, startAt),
                    }
                  : (() => {
                      const selectedShift = data.shifts.find(
                        (x) => x.id === form.shiftId,
                      )!;
                      return {
                        ...selectedShift,
                        workDate: shiftWorkDate(selectedShift, startAt),
                      };
                    })(),
            }
          : {}),
        ...(old?.autoStopped ? { autoStopped: true } : {}),
        ...(old?.demo ? { demo: true } : {}),
      };
      checkEntry(entry, data.entries, timer);
      if (
        await save(
          {
            ...data,
            entries: form.id
              ? data.entries.map((e) => (e.id === entry.id ? entry : e))
              : [...data.entries, entry],
          },
          "Wpis zapisany",
        )
      ) {
        setCalendarDate(dateKey(startAt));
        setCalendarMonth(dateKey(startAt).slice(0, 7));
        setForm(null);
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Nie udało się zapisać.");
    }
  }
  async function download(kind: "csv" | "json") {
    try {
      await exportFile(
        `work-hours-${today}.${kind}`,
        kind === "csv" ? csv(data) : JSON.stringify(data, null, 2),
        kind === "csv" ? "text/csv" : "application/json",
      );
      setNotice(
        kind === "csv"
          ? "Raport CSV przygotowany"
          : "Kopia zapasowa przygotowana",
      );
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Nie udało się wyeksportować danych.",
      );
    }
  }
  async function restore() {
    try {
      const raw = await importFile();
      if (raw === null) return;
      let restored: State;
      try {
        restored = validateBackup(JSON.parse(raw));
      } catch {
        throw new Error(
          "Plik nie jest prawidłową kopią Work Hours. Dane nie zostały zmienione.",
        );
      }
      setConfirm({
        title: "Przywrócić kopię?",
        body: `Plik zawiera ${restored.jobs.length} projektów i ${restored.entries.length} wpisów (${restored.currency}). Zastąpi wszystkie obecne dane, w tym licznik. Najpierw zapisz kopię obecnych danych, jeśli chcesz je zachować.`,
        label: "Zastąp dane",
        danger: true,
        action: () => {
          void save(restored, "Kopia przywrócona").then((ok) => {
            if (ok) {
              setConfirm(null);
              setSelected("");
              setProjectFilter("all");
              setPeriod("all");
            }
          });
        },
      });
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "Nie udało się odczytać pliku.",
      );
    }
  }
  function payDetails(e: Entry) {
    const parts = slices.filter((part) => part.entry.id === e.id);
    const total = totals(parts);
    const days = [...new Set(parts.map((part) => part.date))];
    const normalRate = e.rate + allowanceHourlyRate(e);
    const overtimeRate = extraHourlyRate(e);
    return (
      <View
        style={{
          gap: 10,
          padding: 14,
          backgroundColor: C.raised,
          borderRadius: 16,
        }}
      >
        <Text style={s.rowTitle}>Jak obliczono tę zmianę?</Text>
        <View style={{ gap: 3 }}>
          <Text style={s.caption}>Zwykły czas</Text>
          <Text style={s.rowMoney}>
            {duration(total.regular)} h × {fmt(normalRate)}/h ={" "}
            {fmt((total.regular * normalRate) / 60)}
          </Text>
        </View>
        <View style={{ gap: 3 }}>
          <Text style={s.caption}>Nadgodziny</Text>
          <Text style={s.rowMoney}>
            {duration(total.extra)} h × {fmt(overtimeRate)}/h ={" "}
            {fmt((total.extra * overtimeRate) / 60)}
          </Text>
        </View>
        <View style={s.between}>
          <Text style={s.rowTitle}>Razem za całą zmianę</Text>
          <Text style={s.rowMoney}>{fmt(total.amount)}</Text>
        </View>
        <Text style={s.caption}>
          Stawki zapisane dla tej zmiany, po odliczeniu przerw. Kwoty są
          zaokrąglane do grosza.
        </Text>
        {(e.overtimeThreshold ?? "shift") !== "week" && (
          <Text style={s.caption}>
            Ten wpis korzysta z wcześniejszej zasady nadgodzin. Możesz go
            przeliczyć według normy tygodniowej na pulpicie.
          </Text>
        )}
        {(data.countingMode ?? "shift") === "midnight" && days.length > 1 && (
          <>
            <Text style={s.rowTitle}>Podział między dni</Text>
            {days.map((day) => {
              const dayTotal = totals(
                parts.filter((part) => part.date === day),
              );
              return (
                <View key={day} style={s.between}>
                  <Text verbatim style={s.caption}>
                    {localDate(day).toLocaleDateString(locale, {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · {duration(dayTotal.minutes)} h
                  </Text>
                  <Text style={s.rowMoney}>{fmt(dayTotal.amount)}</Text>
                </View>
              );
            })}
            <Text style={s.caption}>
              „Dzisiaj” pokazuje tylko część zmiany od północy. Kwota za całą
              zmianę obejmuje oba dni.
            </Text>
          </>
        )}
      </View>
    );
  }
  function row(e: Entry, parts?: Slice[]) {
    const applicable = (parts ?? slices).filter((x) => x.entry.id === e.id);
    const first = applicable[0]?.actualDate,
      last = applicable[applicable.length - 1]?.actualDate;
    const lastDay = last ? localDate(last) : null;
    lastDay?.setDate(lastDay.getDate() + 1);
    const displayStart =
      parts && first ? Math.max(e.start, parseLocal(first, "00:00")) : e.start;
    const displayEnd =
      parts && lastDay
        ? Math.min(e.end, parseLocal(dateKey(lastDay), "00:00"))
        : e.end;
    const fragment = displayStart !== e.start || displayEnd !== e.end;
    const j = jobFor(e.jobId),
      t = totals(applicable);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edytuj wpis ${j.name} ${dateKey(e.start)}`}
        key={e.id}
        style={s.entryRow}
        onPress={() => openEntry(e)}
      >
        <View style={[s.entryMark, { backgroundColor: C.muted + "19" }]}>
          <I name="briefcase-outline" color={C.muted} size={19} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <Text style={s.rowTitle}>
            <Text verbatim>{j.name}</Text>
            {e.demo ? " · przykład" : ""}
          </Text>
          {e.shift && (
            <Text
              style={{
                fontSize: 10,
                color: e.shift.kind === "night" ? "#9DAAC0" : "#C7C9CD",
              }}
            >
              {e.shift.name} · norma {duration(e.shift.normHours * 60)} h
              {e.autoStopped ? " · auto-stop" : ""}
            </Text>
          )}
          <Text style={s.caption}>
            {fragment ? "Fragment · " : ""}
            {timeLabel(displayStart)} – {timeLabel(displayEnd)}
            {dateKey(e.start) !== dateKey(e.end)
              ? ` · do ${dateKey(e.end)}`
              : ""}{" "}
            · przerwa{" "}
            {Math.round((displayEnd - displayStart) / 60000 - t.minutes)} min
          </Text>
          {!!e.note && (
            <Text verbatim numberOfLines={1} style={s.caption}>
              {e.note}
            </Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 5 }}>
          <Text style={s.rowMoney}>{fmt(t.amount)}</Text>
          <Text style={s.caption}>
            {duration(t.minutes)} h {t.extra > 0 ? " · OT" : ""}
          </Text>
        </View>
        <I name="chevron-forward" size={16} />
      </Pressable>
    );
  }
  // Dark gradient hero at the top of each screen; on phones the content
  // "sheet" overlaps it with rounded corners, as in the reference design.
  function header(
    eyebrow: string,
    title: string,
    subtitle: string,
    action?: React.ReactNode,
    extra?: React.ReactNode,
  ) {
    return (
      <>
        <View
          style={[
            s.hero,
            heroBackground,
            wide
              ? { borderRadius: 28, marginBottom: 20 }
              : { marginHorizontal: -16, marginTop: -16 },
          ]}
        >
          <View style={s.pageHeader}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.heroEyebrow}>{eyebrow}</Text>
              <Text style={[s.heroTitle, !wide && { fontSize: 30 }]}>
                {title}
              </Text>
              <Text style={s.heroSubtitle}>{subtitle}</Text>
            </View>
            {action}
          </View>
          {extra}
        </View>
        {!wide && <View style={s.heroLip} />}
      </>
    );
  }
  function heroAction(
    label: string,
    icon: Icon,
    onPress: () => void,
    disabled = false,
  ) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          s.heroButton,
          { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        ]}
      >
        <I name={icon} size={22} color="#FFFFFF" />
      </Pressable>
    );
  }
  const navigation = (rail = false) => (
    <View
      style={
        rail
          ? s.railNav
          : [s.bottomNav, { backgroundColor: hero.to, borderColor: hero.from }]
      }
    >
      {tabs.map((t) => (
        <Pressable
          key={t.key}
          accessibilityRole="tab"
          accessibilityLabel={t.label}
          accessibilityState={{ selected: tab === t.key }}
          onPress={() => {
            setTab(t.key);
            setPeriod("all");
          }}
          style={[
            rail ? s.railItem : s.navItem,
            rail && tab === t.key && { backgroundColor: C.raised },
            !rail &&
              tab === t.key && [
                s.navItemSelected,
                { backgroundColor: hero.highlight },
              ],
          ]}
        >
          <I
            name={
              tab === t.key ? (t.icon.replace("-outline", "") as Icon) : t.icon
            }
            size={22}
            color={
              rail
                ? tab === t.key
                  ? C.green
                  : C.muted
                : tab === t.key
                  ? hero.onHighlight
                  : "rgba(255, 255, 255, 0.78)"
            }
          />
          {(rail || tab === t.key) && (
            <Text
              numberOfLines={1}
              style={[
                s.navText,
                {
                  color: rail
                    ? tab === t.key
                      ? C.green
                      : C.muted
                    : hero.onHighlight,
                },
              ]}
            >
              {t.label}
            </Text>
          )}
          {rail && tab === t.key && (
            <View
              style={[
                s.dot,
                {
                  marginLeft: "auto",
                  backgroundColor: C.green,
                  width: 6,
                  height: 6,
                },
              ]}
            />
          )}
        </Pressable>
      ))}
    </View>
  );
  function overlapHelp() {
    if (
      form?.type !== "entry" ||
      formError !== "Ten wpis nakłada się na inną zmianę lub aktywny licznik."
    )
      return null;
    try {
      const start = parseLocal(form.startDate ?? "", form.startTime ?? "");
      const end = parseLocal(form.endDate ?? "", form.endTime ?? "");
      const conflicts = findEntryConflicts(
        { id: form.id ?? "", start, end },
        data.entries,
        timer,
      );
      if (!conflicts.entries.length && !conflicts.activeTimer) return null;
      const clock = (value: number) =>
        new Date(value).toLocaleString(locale, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      return (
        <View
          style={{
            gap: 12,
            borderRadius: 14,
            padding: 14,
            backgroundColor: C.raised,
          }}
        >
          <Text style={s.rowTitle}>Znaleziono nakładającą się pracę</Text>
          <Text style={s.caption}>
            Aby uniknąć podwójnego naliczania, zmień godziny lub popraw zapisany
            wpis.
          </Text>
          {conflicts.entries.slice(0, 4).map((entry) => (
            <View key={entry.id} style={{ gap: 7 }}>
              <Text verbatim style={s.rowTitle}>
                {data.jobs.find((item) => item.id === entry.jobId)?.name ??
                  tr("Miejsce pracy")}
              </Text>
              <Text verbatim style={s.caption}>
                {clock(entry.start)} – {clock(entry.end)}
              </Text>
              <Button
                label="Edytuj istniejącą zmianę"
                kind="secondary"
                icon="create-outline"
                onPress={() => openEntry(entry)}
              />
            </View>
          ))}
          {conflicts.entries.length > 4 && (
            <Text style={s.caption}>
              Znaleziono więcej nakładających się zmian. Popraw je kolejno.
            </Text>
          )}
          {conflicts.activeTimer && timer && (
            <View style={{ gap: 7 }}>
              <Text style={s.rowTitle}>Aktywny licznik</Text>
              <Text style={s.caption}>
                {tr("Rozpoczęto:")} {clock(timer.start)}
              </Text>
              <Button
                label="Popraw początek licznika"
                kind="secondary"
                icon="time-outline"
                onPress={openAdjust}
              />
            </View>
          )}
          <Text style={s.caption}>
            Otwarcie innej zmiany zamknie ten formularz bez zapisywania
            wpisanych tu danych.
          </Text>
        </View>
      );
    } catch {
      return null;
    }
  }
  function weeklyCorrectionBanner() {
    if (!data.weeklyCorrectionNotice) return null;
    return (
      <View style={[s.card, { padding: 16, marginVertical: 12, gap: 10 }]}>
        <Text style={s.rowTitle}>Poprawiono sposób liczenia nadgodzin</Text>
        <Text style={s.caption}>
          Wcześniejsze wpisy przeliczono według normy tygodniowej zapisanej w
          miejscu pracy. Kwoty mogły się zmienić. Stawki, przerwy i oznaczenia
          wypłat pozostały bez zmian.
        </Text>
        <Button
          label="Rozumiem"
          kind="secondary"
          onPress={() => void save({ ...data, weeklyCorrectionNotice: false })}
        />
      </View>
    );
  }
  function openWeeklyBalance(
    workplace: Job | undefined,
    targetWeek: string,
    balance: number,
  ) {
    if (timer) {
      setNotice(
        "Najpierw zakończ aktywną zmianę, aby ustawić stan po jej zakończeniu.",
      );
      return;
    }
    if (!workplace) {
      openJob();
      return;
    }
    setFormError("");
    setForm({
      type: "weekBalance",
      jobId: workplace.id,
      week: targetWeek,
      balance: formatDuration(balance, "clock", language),
    });
  }
  function home() {
    const timerJob = timer ? jobFor(timer.jobId) : job;
    const liveWeekSlices = liveCalculated.filter(
      (x) => weekKey(localDate(x.weekDate)) === week,
    );
    const activeWeek =
      timer && data.weekBoundary === "shift" ? weekKey(timer.start) : week;
    const weekDate = localDate(activeWeek);
    weekDate.setDate(weekDate.getDate() + dashboardWeekOffset * 7);
    const displayedWeek = weekKey(weekDate);
    const weekData = dashboardWeek(
      liveCalculated,
      displayedWeek,
      timerJob?.id ?? "",
    );
    const currentWeekData = dashboardWeek(
      liveCalculated,
      activeWeek,
      timerJob?.id ?? "",
    );
    const weeklyTarget =
      (timer?.weeklyHours ?? timerJob?.weeklyHours ?? 40) * 60;
    const hasCurrentCorrection = data.balanceCorrections.some(
      (item) => item.jobId === timerJob?.id && item.week === activeWeek,
    );
    const hasWeekCorrection = data.balanceCorrections.some(
      (item) => item.jobId === timerJob?.id && item.week === displayedWeek,
    );
    const currentCorrection = weeklyCorrectionMinutes(
      data.balanceCorrections,
      timerJob?.id ?? "",
      activeWeek,
    );
    const weekCorrection = weeklyCorrectionMinutes(
      data.balanceCorrections,
      timerJob?.id ?? "",
      displayedWeek,
    );
    const currentHoliday = weekHolidayMinutes(data.holidays, activeWeek);
    const weekHoliday = weekHolidayMinutes(data.holidays, displayedWeek);
    const currentBalance =
      currentWeekData.total.minutes + currentCorrection + currentHoliday;
    const displayedBalance =
      weekData.total.minutes + weekCorrection + weekHoliday;
    const remaining = Math.max(0, weeklyTarget - currentBalance);
    const earlierThisShift = timer?.shift
      ? totals(
          slices.filter(
            (part) =>
              part.entry.jobId === timer.jobId &&
              part.entry.shift?.id === timer.shift?.id &&
              part.entry.shift?.workDate === timer.shift?.workDate,
          ),
        ).minutes
      : 0;
    const dateLabel = (date: string) =>
      localDate(date).toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "short",
      });
    const historicalPolicies = data.entries.filter(
      (entry) =>
        entry.jobId === timerJob?.id &&
        (entry.overtimeThreshold ?? "shift") !== "week",
    ).length;
    const dashboardActions: {
      label: string;
      text: string;
      icon: Icon;
      onPress: () => void;
    }[] = [
      ...(timer
        ? [
            {
              label: "Popraw początek",
              text: "Popraw początek",
              icon: "play-back-outline" as Icon,
              onPress: openAdjust,
            },
            {
              label: "Popraw koniec",
              text: "Popraw koniec",
              icon: "play-forward-outline" as Icon,
              onPress: () => {
                setFormError("");
                setForm({
                  type: "stopAt",
                  endDate: dateKey(now),
                  endTime: timeLabel(now),
                });
              },
            },
            {
              label: timer.pausedAt === null ? "Przerwa" : "Wznów",
              text: timer.pausedAt === null ? "Przerwa" : "Wznów",
              icon: (timer.pausedAt === null
                ? "cafe-outline"
                : "play-outline") as Icon,
              onPress: () => void togglePause(),
            },
          ]
        : [
            {
              label: "Start od godziny",
              text: "Start od godziny",
              icon: "time-outline" as Icon,
              onPress: () => (job ? openStart() : openJob()),
            },
          ]),
      {
        label: "Dodaj wcześniejszą zmianę",
        text: "Wpis ręczny",
        icon: "add-circle-outline",
        onPress: () =>
          job ? openEntry(undefined, previousLocalDay(now)) : openJob(),
      },
      {
        label: "Dodaj urlop",
        text: "Dodaj urlop",
        icon: "airplane-outline",
        onPress: () => {
          const existing = data.holidays.find((h) => h.date === today);
          openHoliday(existing, existing ? undefined : today);
        },
      },
      {
        label: "Dopasuj stan z czytnika",
        text: "Stan z czytnika",
        icon: "speedometer-outline",
        onPress: () => openWeeklyBalance(timerJob, activeWeek, currentBalance),
      },
    ];
    return (
      <>
        {header(
          "TWÓJ CZAS PRACY",
          "Twoja zmiana.",
          new Date(now).toLocaleDateString(locale, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          heroAction("Ustawienia", "person-outline", () => setTab("settings")),
          timerJob ? (
            <View style={{ marginTop: 22, gap: 6 }}>
              <Text style={s.heroSubtitle}>Wykonano w tym tygodniu</Text>
              <View style={[s.between, { alignItems: "flex-end" }]}>
                <Text verbatim style={s.heroNumber}>
                  {duration(currentBalance)}
                  <Text style={s.heroUnit}> h</Text>
                </Text>
                <View style={s.heroChip}>
                  <Text verbatim style={s.heroChipText}>
                    {tr("Norma")} {duration(weeklyTarget)} h
                  </Text>
                </View>
              </View>
              <View style={s.heroTrack}>
                <View
                  style={{
                    width: `${Math.min(100, (currentBalance / Math.max(1, weeklyTarget)) * 100)}%`,
                    height: "100%",
                    borderRadius: 4,
                    backgroundColor: hero.highlight,
                  }}
                />
              </View>
            </View>
          ) : undefined,
        )}
        {weeklyCorrectionBanner()}
        <View style={[s.card, { padding: 16, gap: 12 }]}>
          {!timer && data.shifts.length > 1 && (
            <View style={[s.row, { flexWrap: "wrap" }]}>
              {data.shifts.map((v) => (
                <Chip
                  key={v.id}
                  label={v.name}
                  active={data.preferredShiftId === v.id}
                  onPress={() =>
                    void save(
                      { ...data, preferredShiftId: v.id },
                      "Wybrano zmianę na pulpit",
                    )
                  }
                />
              ))}
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 6 }}>
            {[
              {
                label: tr("Zegar pracy"),
                value: new Date(now).toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }),
                note: timer ? tr("W trakcie zmiany") : tr("Gotowy do startu"),
                icon: "time-outline" as Icon,
                tint: "#EEEBFD",
                mint: "#DDF5EC",
              },
              {
                label: tr("Do normy"),
                value: timerJob ? `${duration(remaining)} h` : "—",
                note: timerJob
                  ? `${tr("Norma")} ${duration(weeklyTarget)} h`
                  : tr("Ustaw miejsce pracy"),
                icon: "hourglass-outline" as Icon,
                tint: "#FFF4D6",
                mint: "#EEF7DA",
              },
              {
                label: tr("Wykonano"),
                value: timerJob ? `${duration(currentBalance)} h` : "—",
                note: hasCurrentCorrection
                  ? tr("Z korektą salda")
                  : currentHoliday
                    ? tr("Z urlopem")
                    : tr("W tym tygodniu"),
                icon: "checkmark-done-outline" as Icon,
                tint: "#FDE9F0",
                mint: "#DCEFF3",
              },
            ].map((item) => (
              <View
                key={item.label}
                style={{
                  flex: 1,
                  minWidth: 0,
                  backgroundColor:
                    theme === "pastel"
                      ? item.tint
                      : theme === "emerald"
                        ? item.mint
                        : C.raised,
                  borderRadius: 20,
                  borderCurve: "continuous",
                  paddingHorizontal: 11,
                  paddingVertical: 12,
                  gap: 6,
                }}
              >
                <I name={item.icon} size={18} color={C.text} />
                <Text verbatim style={[s.caption, { minHeight: 34 }]}>
                  {item.label}
                </Text>
                <Text
                  verbatim
                  numberOfLines={1}
                  style={[
                    s.rowTitle,
                    {
                      fontSize: width < 360 ? 13 : 17,
                      fontWeight: "700",
                      letterSpacing: -0.3,
                      fontVariant: ["tabular-nums"],
                    },
                  ]}
                >
                  {item.value}
                </Text>
                <Text verbatim style={[s.caption, { fontSize: 10 }]}>
                  {item.note}
                </Text>
              </View>
            ))}
          </View>
          <View style={s.shiftInfo}>
            <View style={s.shiftIcon}>
              <I
                name={
                  (timer?.shift ?? shift).kind === "night"
                    ? "moon-outline"
                    : "sunny-outline"
                }
                size={20}
                color={C.green}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text verbatim numberOfLines={1} style={s.rowTitle}>
                {timerJob
                  ? `${timerJob.name} · ${tr(timer?.shift?.name ?? shift.name)}`
                  : tr("Dodaj miejsce pracy, aby rozpocząć.")}
              </Text>
              <Text verbatim style={s.caption}>
                {(timer?.shift ?? shift).startTime} –{" "}
                {(timer?.shift ?? shift).endTime}
                {(timer?.shift ?? shift).endTime <
                (timer?.shift ?? shift).startTime
                  ? " · +1 " + tr("dzień")
                  : ""}
                {timer?.plannedEnd !== undefined
                  ? ` · ${tr("Automatyczny koniec:")} ${new Date(
                      timer.plannedEnd,
                    ).toLocaleString(locale, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : !timer && shift.autoStop
                    ? ` · ${tr("Automatyczny stop o")} ${shift.endTime}`
                    : ""}
              </Text>
            </View>
          </View>
          {timer && (
            <View style={s.liveBox}>
              <View style={s.row}>
                <View
                  style={[
                    s.dot,
                    {
                      backgroundColor:
                        timer.pausedAt !== null ? "#E8A317" : "#30C26A",
                    },
                  ]}
                />
                <Text style={s.caption}>
                  {timer.pausedAt !== null ? "Przerwa" : "Bieżąca zmiana"}
                </Text>
              </View>
              <Text verbatim style={s.liveClock}>
                {formatCountdown(earlierThisShift + timerMinutes(timer, now))}
              </Text>
            </View>
          )}
          {timer ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zakończ zmianę"
              disabled={busy}
              onPress={() => void stop()}
              style={({ pressed }) => [
                s.mainAction,
                {
                  backgroundColor: "#D7332B",
                  boxShadow: "0px 8px 20px rgba(215, 51, 43, 0.3)",
                  opacity: busy ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <I name="stop" size={18} color="#FFFFFF" />
              <Text style={s.mainActionText}>Zakończ zmianę</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start zmiany"
              disabled={busy}
              onPress={() => (job ? void start() : openJob())}
              style={({ pressed }) => [
                s.mainAction,
                {
                  backgroundColor: lightTheme ? "#1F7F37" : "#30D158",
                  boxShadow: "0px 8px 20px rgba(31, 127, 55, 0.3)",
                  opacity: busy ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <I
                name="play"
                size={18}
                color={lightTheme ? "#FFFFFF" : "#00230A"}
              />
              <Text
                style={[
                  s.mainActionText,
                  { color: lightTheme ? "#FFFFFF" : "#00230A" },
                ]}
              >
                Rozpocznij zmianę
              </Text>
            </Pressable>
          )}
          <View style={s.tileGrid}>
            {dashboardActions.map((a) => (
              <Pressable
                key={a.label}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                disabled={busy}
                onPress={a.onPress}
                style={({ pressed }) => [
                  s.tile,
                  {
                    width: dashboardActions.length > 4 ? "31.5%" : "48.5%",
                    opacity: busy ? 0.5 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View style={s.tileIcon}>
                  <I name={a.icon} size={20} color={C.green} />
                </View>
                <Text numberOfLines={2} style={s.tileText}>
                  {a.text}
                </Text>
              </Pressable>
            ))}
          </View>
          {timer && !!timer.autoBreakMinutes && (
            <Text style={s.caption}>
              Automatyczna przerwa zostanie odjęta po zakończeniu zmiany.
            </Text>
          )}
        </View>
        <View style={[s.card, { padding: 16, marginTop: 16, gap: 10 }]}>
          <View style={s.between}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Poprzedni tydzień"
              onPress={() => setDashboardWeekOffset((n) => n - 1)}
              style={s.iconTile}
            >
              <I name="chevron-back" size={18} color={C.text} />
            </Pressable>
            <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
              <Text style={s.rowTitle}>Tydzień</Text>
              <Text verbatim style={s.caption}>
                {weekTitle(displayedWeek, locale)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Następny tydzień"
              onPress={() => setDashboardWeekOffset((n) => n + 1)}
              style={s.iconTile}
            >
              <I name="chevron-forward" size={18} color={C.text} />
            </Pressable>
          </View>
          <View
            style={[
              s.between,
              {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderColor: C.line,
                paddingBottom: 8,
              },
            ]}
          >
            <Text style={s.caption}>Dzień</Text>
            <Text style={s.caption}>Start – koniec · razem</Text>
          </View>
          {weekData.days.map((day) => {
            const entries = [
              ...new Map(
                day.parts.map((part) => [part.entry.id, part.entry]),
              ).values(),
            ].sort((a, b) => a.start - b.start);
            const holiday = data.holidays.find(
              (item) => item.date === day.date,
            );
            return (
              <View
                key={day.date}
                style={{
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderColor: C.line,
                  paddingVertical: 10,
                  gap: 6,
                }}
              >
                <View style={s.between}>
                  <Text
                    verbatim
                    style={[
                      s.rowTitle,
                      { textTransform: "capitalize", flex: 1 },
                    ]}
                  >
                    {dateLabel(day.date)}
                  </Text>
                  <Text style={s.caption}>
                    {day.total.minutes
                      ? `${duration(day.total.minutes)} h`
                      : "—"}
                  </Text>
                </View>
                {entries.map((entry) => {
                  const parts = day.parts.filter(
                    (part) => part.entry.id === entry.id,
                  );
                  const first = parts[0].actualDate,
                    last = localDate(parts[parts.length - 1].actualDate);
                  last.setDate(last.getDate() + 1);
                  const from = Math.max(
                    entry.start,
                    parseLocal(first, "00:00"),
                  );
                  const to = Math.min(
                    entry.end,
                    parseLocal(dateKey(last), "00:00"),
                  );
                  const saved = data.entries.find(
                    (item) => item.id === entry.id,
                  );
                  return (
                    <Pressable
                      key={entry.id}
                      accessibilityRole="button"
                      accessibilityLabel={
                        saved
                          ? `Edytuj wpis ${dateKey(entry.start)}`
                          : tr("Trwająca zmiana")
                      }
                      disabled={!saved}
                      onPress={() => saved && openEntry(saved)}
                      style={[s.between, { paddingVertical: 4 }]}
                    >
                      <Text style={s.caption}>
                        {timeLabel(from)} –{" "}
                        {saved ? timeLabel(to) : tr("teraz")}
                        {!saved ? ` · ${tr("w trakcie")}` : ""}
                      </Text>
                      <Text style={s.rowTitle}>
                        {duration(totals(parts).minutes)} h {saved ? "›" : ""}
                      </Text>
                    </Pressable>
                  );
                })}
                {holiday && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${tr("Edytuj urlop")} ${holiday.date}`}
                    onPress={() => openHoliday(holiday)}
                    style={[s.between, { paddingVertical: 4 }]}
                  >
                    <Text style={s.caption}>Urlop</Text>
                    <Text style={s.rowTitle}>
                      {duration(holiday.hours * 60)} h ›
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          {weekHoliday > 0 && (
            <View style={s.between}>
              <Text style={s.caption}>Urlop w tygodniu</Text>
              <Text style={s.rowTitle}>+{duration(weekHoliday)} h</Text>
            </View>
          )}
          {hasWeekCorrection && (
            <View style={s.between}>
              <Text style={s.caption}>Korekta salda</Text>
              <Text style={s.rowTitle}>
                {weekCorrection < 0 ? "−" : "+"}
                {duration(Math.abs(weekCorrection))} h
              </Text>
            </View>
          )}
          <View style={[s.between, { paddingTop: 4 }]}>
            <Text style={s.rowTitle}>Razem w tygodniu</Text>
            <Text style={s.rowTitle}>{duration(displayedBalance)} h</Text>
          </View>
          {displayedBalance < 0 && (
            <Text style={s.caption}>
              Korekta jest większa niż suma wpisów. Ustaw stan ponownie.
            </Text>
          )}
          <View style={s.between}>
            <Text style={s.caption}>Nadgodziny z wpisów</Text>
            <Text style={s.rowTitle}>{duration(weekData.total.extra)} h</Text>
          </View>
          <Button
            label="Dopasuj ten tydzień"
            kind="secondary"
            icon="create-outline"
            disabled={!timerJob || displayedWeek > week}
            onPress={() =>
              openWeeklyBalance(timerJob, displayedWeek, displayedBalance)
            }
          />
          <Text style={s.caption}>
            Korekta zmienia stan godzin i próg dla kolejnej pracy. Nie zmienia
            zarobków z zapisanych zmian.
          </Text>
          <Text style={s.caption}>
            Godziny urlopu wliczają się do sumy tygodnia i normy. Dotknij
            urlopu, aby go zmienić lub usunąć.
          </Text>
        </View>
        {historicalPolicies > 0 && timerJob && (
          <View style={[s.card, { padding: 14, marginTop: 14, gap: 8 }]}>
            <Text style={s.rowTitle}>
              Wcześniejsze wpisy mają inną zasadę nadgodzin
            </Text>
            <Text style={s.caption}>
              Możesz przeliczyć je według normy tygodniowej. Stawki i przerwy
              pozostaną bez zmian.
            </Text>
            <Button
              label="Przelicz wcześniejsze wpisy"
              icon="calculator-outline"
              kind="secondary"
              onPress={() => openWeeklyNorm(timerJob, true)}
            />
          </View>
        )}
        {!timer &&
          data.entries.length > 0 &&
          (() => {
            const last = [...data.entries].sort((a, b) => b.end - a.end)[0];
            return (
              <View style={[s.card, { marginTop: 16 }]}>
                <View style={[s.row, { padding: 15, paddingBottom: 0 }]}>
                  <I name="checkmark-circle" color={C.green} size={17} />
                  <Text
                    style={{ color: C.text, fontSize: 12, fontWeight: "600" }}
                  >
                    Ostatnia zmiana · całość
                  </Text>
                  <Text style={[s.caption, { marginLeft: "auto" }]}>
                    {timeLabel(last.end)}
                  </Text>
                </View>
                {row(last)}
                <View
                  style={{
                    paddingHorizontal: 15,
                    paddingTop: 14,
                    paddingBottom: 15,
                    gap: 10,
                  }}
                >
                  <Button
                    label={
                      payDetailsOpen ? "Ukryj obliczenia" : "Pokaż obliczenia"
                    }
                    icon="calculator-outline"
                    kind="secondary"
                    onPress={() => setPayDetailsOpen(!payDetailsOpen)}
                  />
                  {payDetailsOpen && payDetails(last)}
                </View>
              </View>
            );
          })()}
        <View style={s.sectionHeader}>
          <View style={[s.row, { flexShrink: 1 }]}>
            <Text style={[s.sectionTitle, { flexShrink: 1 }]}>
              Twoje projekty
            </Text>
            <Text style={s.count}>{jobs.length}</Text>
          </View>
          <Button
            label="Nowy projekt"
            icon="add"
            kind="ghost"
            small
            onPress={() => openJob()}
          />
        </View>
        {jobs.length === 0 ? (
          <View style={s.card}>
            <Empty
              title="Pierwszy krok? Twój projekt."
              body="Wpisz nazwę, stawkę godzinową i zasady nadgodzin. Potem wystarczy nacisnąć start."
              action={
                <Button
                  label="Utwórz projekt"
                  onPress={() => openJob()}
                  icon="add"
                />
              }
            />
          </View>
        ) : (
          <View
            style={[
              s.projectGrid,
              wide && { flexDirection: "row", flexWrap: "wrap" },
            ]}
          >
            {jobs.map((j) => {
              const jt = totals(
                liveWeekSlices.filter((x) => x.entry.jobId === j.id),
              );
              const jobWeekBalance =
                jt.minutes +
                weeklyCorrectionMinutes(data.balanceCorrections, j.id, week);
              return (
                <View
                  key={j.id}
                  style={[
                    s.projectCard,
                    wide && { width: "48.8%" },
                    job?.id === j.id && { borderColor: C.green + "70" },
                  ]}
                >
                  <View style={s.between}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Wybierz projekt ${j.name}`}
                      onPress={() => setSelected(j.id)}
                      style={[s.row, { flex: 1 }]}
                    >
                      <View
                        style={[
                          s.projectIcon,
                          { backgroundColor: C.muted + "18" },
                        ]}
                      >
                        <I name="briefcase-outline" color={C.muted} />
                      </View>
                      <View style={{ gap: 5, flex: 1 }}>
                        <Text verbatim style={s.rowTitle}>
                          {j.name}
                        </Text>
                        <Text style={s.caption}>
                          {tr("Zwykła")} {fmt(j.rate + allowanceHourlyRate(j))}{" "}
                          / h · OT {fmt(extraHourlyRate(j))} / h
                        </Text>
                      </View>
                      {job?.id === j.id && (
                        <I name="checkmark-circle" color={C.green} size={18} />
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edytuj projekt ${j.name}`}
                      style={{ padding: 8 }}
                      onPress={() => openJob(j)}
                    >
                      <I name="ellipsis-horizontal" />
                    </Pressable>
                  </View>
                  <View style={s.projectFooter}>
                    <Text style={s.caption}>
                      Ten tydzień · {duration(jobWeekBalance)} h
                    </Text>
                    <Text style={s.rowMoney}>{fmt(jt.amount)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <View style={{ marginTop: 14 }}>
          <Button
            label="Otwórz kalendarz"
            icon="calendar-outline"
            kind="secondary"
            onPress={() => setTab("entries")}
          />
        </View>
      </>
    );
  }
  function entryFilters() {
    return (
      <>
        <View style={[s.searchBox, s.row]}>
          <I name="search-outline" />
          <TextInput
            accessibilityLabel="Szukaj wpisów"
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              setPeriod("all");
            }}
            placeholder="Szukaj projektu, notatki lub daty…"
            placeholderTextColor={C.muted}
            style={s.searchInput}
          />
          {!!search && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Wyczyść wyszukiwanie"
              onPress={() => setSearch("")}
            >
              <I name="close-circle" />
            </Pressable>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}
        >
          <Chip
            label="Wszystkie projekty"
            active={projectFilter === "all"}
            onPress={() => {
              setProjectFilter("all");
              setPeriod("all");
            }}
          />
          {data.jobs.map((j) => (
            <Chip
              key={j.id}
              dot={C.muted}
              label={j.name + (j.archived ? " · archiwum" : "")}
              active={projectFilter === j.id}
              onPress={() => {
                setProjectFilter(j.id);
                setPeriod("all");
              }}
            />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
        >
          {[
            { id: "all", name: "Wszystkie zmiany" },
            { id: "day", name: "Dzienne" },
            { id: "night", name: "Nocne" },
            { id: "legacy", name: "Bez typu" },
          ].map((x) => (
            <Chip
              key={x.id}
              label={x.name}
              active={shiftFilter === x.id}
              onPress={() => {
                setShiftFilter(x.id);
                setPeriod("all");
              }}
            />
          ))}
        </ScrollView>
      </>
    );
  }
  function entryViewToggle() {
    return (
      <View style={[s.row, { marginBottom: 12 }]}>
        <View style={[s.segment, { flex: 1 }]}>
          {(["calendar", "list"] as const).map((v, i) => (
            <Pressable
              key={v}
              accessibilityRole="tab"
              accessibilityLabel={i ? "Widok listy" : "Widok kalendarza"}
              accessibilityState={{ selected: entryView === v }}
              onPress={() => setEntryView(v)}
              style={[s.segmentItem, entryView === v && s.segmentActive]}
            >
              <Text
                style={[s.segmentText, entryView === v && { color: C.text }]}
              >
                {i ? "Lista" : "Kalendarz"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pokaż filtry"
          accessibilityState={{ expanded: showFilters }}
          onPress={() => setShowFilters(!showFilters)}
          style={s.avatar}
        >
          <I name="filter-outline" color={showFilters ? C.green : C.muted} />
        </Pressable>
      </View>
    );
  }
  function chooseDay(day: string) {
    setCalendarDate(day);
    setCalendarMonth(day.slice(0, 7));
    // A holiday-only day opens straight into its edit sheet (change or delete).
    const holiday = data.holidays.find((h) => h.date === day);
    if (holiday && !slices.some((x) => x.date === day)) openHoliday(holiday);
  }
  function confirmDeleteHoliday(id: string, closeForm = false) {
    setConfirm({
      title: "Usunąć ten urlop?",
      body: "Ten dzień zostanie usunięty z kalendarza i podsumowania urlopów.",
      label: "Usuń urlop",
      danger: true,
      action: () => {
        void save(
          { ...data, holidays: data.holidays.filter((h) => h.id !== id) },
          "Urlop usunięty",
        ).then((ok) => {
          if (ok) {
            setConfirm(null);
            if (closeForm) setForm(null);
          }
        });
      },
    });
  }
  function chooseMonth(value: string) {
    setCalendarMonth(value);
    setCalendarDate(value === month ? today : value + "-01");
  }
  function entries() {
    const filtered = slices.filter(
      (x) =>
        (projectFilter === "all" || x.entry.jobId === projectFilter) &&
        (shiftFilter === "all" ||
          (shiftFilter === "legacy"
            ? !x.entry.shift
            : x.entry.shift?.kind === shiftFilter)) &&
        `${jobFor(x.entry.jobId).name} ${x.entry.note} ${x.entry.shift?.name ?? ""} ${x.date}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    );
    const key = (x: (typeof slices)[number]) =>
      group === "days"
        ? x.date
        : group === "weeks"
          ? weekKey(localDate(x.weekDate))
          : group === "months"
            ? x.date.slice(0, 7)
            : x.entry.jobId;
    const grouped = new Map<string, typeof slices>();
    filtered.forEach((x) => {
      const k = key(x);
      grouped.set(k, [...(grouped.get(k) ?? []), x]);
    });
    const ft = totals(
      period === "all" ? filtered : filtered.filter((x) => key(x) === period),
    );
    if (entryView === "calendar") {
      const selectedSlices = filtered.filter((x) => x.date === calendarDate),
        dayTotals = totals(selectedSlices);
      const holiday = data.holidays.find((h) => h.date === calendarDate);
      const monthHolidays = data.holidays.filter((h) =>
        h.date.startsWith(calendarMonth),
      );
      const yearHolidays = data.holidays.filter((h) =>
        h.date.startsWith(calendarMonth.slice(0, 4)),
      );
      const holidaySettings = data.holidaySettings?.[calendarMonth.slice(0, 4)];
      const unique = [
        ...new Map(selectedSlices.map((x) => [x.entry.id, x.entry])).values(),
      ].sort((a, b) => a.start - b.start);
      return (
        <>
          {header(
            "EWIDENCJA PRACY",
            "Kalendarz pracy.",
            "Dotknij dnia, aby zobaczyć zmiany lub urlop.",
            heroAction(
              "Dodaj wpis",
              "add",
              () =>
                jobs.length ? openEntry(undefined, calendarDate) : openJob(),
              calendarDate > today,
            ),
          )}
          {entryViewToggle()}
          {showFilters && entryFilters()}
          <WorkCalendar
            month={calendarMonth}
            selected={calendarDate}
            today={today}
            slices={filtered}
            holidays={data.holidays}
            currency={data.currency}
            timeFormat={data.timeFormat}
            metric={data.calendarMetric ?? "hours"}
            onMetric={(calendarMetric) =>
              void save({ ...data, calendarMetric })
            }
            onSelect={chooseDay}
            onMonth={chooseMonth}
          />
          {data.balanceCorrections.length > 0 && (
            <Text style={[s.caption, { marginTop: 10 }]}>
              Kalendarz pokazuje zapisane zmiany. Korekty salda są widoczne w
              stanie tygodnia na pulpicie.
            </Text>
          )}
          <View style={[s.card, { padding: 14, marginTop: 12, gap: 10 }]}>
            <View style={s.between}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.rowTitle}>Urlop w tym miesiącu</Text>
                <Text style={s.caption}>
                  {monthHolidays.length} dni ·{" "}
                  {duration(
                    monthHolidays.reduce((sum, h) => sum + h.hours * 60, 0),
                  )}{" "}
                  h ·{" "}
                  {fmt(
                    monthHolidays.reduce((sum, h) => sum + h.hours * h.rate, 0),
                  )}
                </Text>
              </View>
              {!holiday && (
                <Button
                  label="Dodaj urlop"
                  icon="add"
                  kind="secondary"
                  small
                  onPress={() => openHoliday(undefined, calendarDate)}
                />
              )}
            </View>
            {holiday && (
              <>
                <Text style={s.caption}>
                  {tr("Wybrany dzień")}: {duration(holiday.hours * 60)} h ·{" "}
                  {fmt(holiday.hours * holiday.rate)}.{" "}
                  {tr("Godziny urlopu wliczają się do sumy tygodnia i normy.")}
                </Text>
                <View style={[s.row, { flexWrap: "wrap" }]}>
                  <Button
                    label="Edytuj urlop"
                    icon="create-outline"
                    kind="ghost"
                    small
                    onPress={() => openHoliday(holiday)}
                  />
                  <Button
                    label="Usuń urlop"
                    icon="trash-outline"
                    kind="danger"
                    small
                    disabled={busy}
                    onPress={() => confirmDeleteHoliday(holiday.id)}
                  />
                </View>
              </>
            )}
            <Text style={s.caption}>
              {tr("Zapisane i zaplanowane dni")}: {yearHolidays.length}
              {holidaySettings ? ` / ${holidaySettings.days}` : ""} ·{" "}
              {duration(yearHolidays.reduce((sum, h) => sum + h.hours * 60, 0))}{" "}
              h
            </Text>
            {holidaySettings && (
              <Text style={s.caption}>
                {tr("Pozostały limit")}:{" "}
                {Math.max(0, holidaySettings.days - yearHolidays.length)} ·{" "}
                {tr("Stawka domyślna")}: {fmt(holidaySettings.rate)}/h
                {yearHolidays.length > holidaySettings.days
                  ? ` · ${tr("Przekroczono limit")}: ${yearHolidays.length - holidaySettings.days}`
                  : ""}
              </Text>
            )}
            <Button
              label="Ustaw limit i stawkę urlopu"
              icon="settings-outline"
              kind="secondary"
              small
              onPress={openHolidaySettings}
            />
            <Text style={s.caption}>
              Urlopy są zapisywane w kopii JSON. Raport CSV zawiera wyłącznie
              czas pracy.
            </Text>
          </View>
          <View style={[s.sectionHeader, { marginTop: 17, marginBottom: 10 }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[s.sectionTitle, { fontSize: 15 }]}>
                {localDate(calendarDate).toLocaleDateString(locale, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </Text>
              <Text style={s.caption}>
                {duration(dayTotals.minutes)} h · nadgodziny{" "}
                {duration(dayTotals.extra)} h
              </Text>
            </View>
            <Text style={s.rowMoney}>{fmt(dayTotals.amount)}</Text>
          </View>
          <View style={s.card}>
            {unique.length ? (
              unique.map((e) => row(e, selectedSlices))
            ) : (
              <View style={{ padding: 18, gap: 12 }}>
                <Text style={s.rowTitle}>Brak wpisów w tym dniu</Text>
                <Text style={s.caption}>
                  {calendarDate > today
                    ? "Wpis dodasz po zakończeniu pracy w tym dniu."
                    : "Dodaj przepracowaną zmianę lub wybierz inny dzień."}
                </Text>
                {calendarDate <= today && (
                  <Button
                    label="Dodaj zmianę w tym dniu"
                    icon="add"
                    kind="secondary"
                    small
                    onPress={() =>
                      jobs.length
                        ? openEntry(undefined, calendarDate)
                        : openJob()
                    }
                  />
                )}
              </View>
            )}
          </View>
        </>
      );
    }
    return (
      <>
        {header(
          "EWIDENCJA PRACY",
          "Twój czas w szczegółach.",
          "Wszystkie zmiany, przerwy i zarobki w jednym miejscu.",
          wide ? (
            <Button
              label="Dodaj wpis"
              icon="add"
              onPress={() => (jobs.length ? openEntry() : openJob())}
            />
          ) : undefined,
        )}
        {!wide && (
          <View style={{ marginBottom: 16 }}>
            <Button
              label="Dodaj wpis"
              icon="add"
              kind="secondary"
              onPress={() => (jobs.length ? openEntry() : openJob())}
            />
          </View>
        )}
        {entryViewToggle()}
        {showFilters && entryFilters()}
        <View style={s.segment}>
          {(["days", "weeks", "months", "jobs"] as const).map((k, i) => (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: group === k }}
              style={[s.segmentItem, group === k && s.segmentActive]}
              onPress={() => {
                setGroup(k);
                setPeriod("all");
              }}
            >
              <Text style={[s.segmentText, group === k && { color: C.text }]}>
                {["Dni", "Tygodnie", "Miesiące", "Projekty"][i]}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={[s.summaryStrip, !wide && { flexWrap: "wrap" }]}>
          <View style={[{ flex: 1, gap: 5 }, !wide && { flexBasis: "100%" }]}>
            <Text style={s.caption}>ZAROBKI</Text>
            <Text style={s.summaryMoney}>{fmt(ft.amount)}</Text>
          </View>
          <View style={{ gap: 5 }}>
            <Text style={s.caption}>CZAS WPISÓW</Text>
            <Text style={s.summaryValue}>{duration(ft.minutes)} h</Text>
          </View>
          <View style={{ gap: 5 }}>
            <Text style={s.caption}>NADGODZINY</Text>
            <Text style={s.summaryValue}>{duration(ft.extra)} h</Text>
          </View>
        </View>
        {data.balanceCorrections.length > 0 && (
          <Text style={[s.caption, { marginBottom: 12 }]}>
            Lista pokazuje godziny zapisanych zmian, bez korekt salda.
          </Text>
        )}
        {period !== "all" && (
          <Button
            label="Wróć do wszystkich okresów"
            icon="arrow-back"
            kind="ghost"
            onPress={() => setPeriod("all")}
          />
        )}
        {!grouped.size ? (
          <View style={s.card}>
            <Empty
              icon="search-outline"
              title={
                data.entries.length
                  ? "Brak pasujących wpisów"
                  : "Jeszcze bez wpisów"
              }
              body={
                data.entries.length
                  ? "Zmień wyszukiwanie lub wybierz inny projekt."
                  : "Dodaj zakończoną zmianę lub skorzystaj z licznika na pulpicie."
              }
            />
          </View>
        ) : (
          [...grouped.entries()]
            .sort(([a], [b]) => b.localeCompare(a))
            .filter(([k]) => period === "all" || period === k)
            .map(([k, list]) => {
              const t = totals(list);
              const unique = [
                ...new Map(list.map((x) => [x.entry.id, x.entry])).values(),
              ].sort((a, b) => b.start - a.start);
              return (
                <View key={k} style={[s.card, { marginBottom: 14 }]}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setPeriod(period === "all" ? k : "all")}
                    style={s.groupHeader}
                  >
                    <View style={{ gap: 5, flex: 1 }}>
                      <Text style={s.groupTitle}>
                        {group === "jobs"
                          ? jobFor(k).name
                          : group === "weeks"
                            ? weekTitle(k, locale)
                            : group === "months"
                              ? localDate(k + "-01").toLocaleDateString(
                                  locale,
                                  { month: "long", year: "numeric" },
                                )
                              : localDate(k).toLocaleDateString(locale, {
                                  weekday: "long",
                                  day: "numeric",
                                  month: "long",
                                })}
                      </Text>
                      <Text style={s.caption}>
                        {duration(t.minutes)} h · {unique.length}{" "}
                        {unique.length === 1 ? "wpis" : "wpisów"}
                      </Text>
                    </View>
                    <Text style={s.rowMoney}>{fmt(t.amount)}</Text>
                    <I
                      name={period === k ? "chevron-up" : "chevron-down"}
                      size={17}
                    />
                  </Pressable>
                  {period === k || group === "days" ? (
                    unique.map((e) => row(e, list))
                  ) : (
                    <View style={s.groupPreview}>
                      <Text verbatim style={s.caption}>
                        {[
                          ...new Set(
                            list.map((x) => jobFor(x.entry.jobId).name),
                          ),
                        ].join(" · ")}
                      </Text>
                      <Text style={s.caption}>Zobacz wpisy →</Text>
                    </View>
                  )}
                </View>
              );
            })
        )}
      </>
    );
  }
  function reports() {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = localDate(week);
      d.setDate(d.getDate() + i);
      return {
        key: dateKey(d),
        label: ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"][i],
        ...totals(weekSlices.filter((x) => x.weekDate === dateKey(d))),
      };
    });
    const max = Math.max(8 * 60, ...days.map((d) => d.minutes));
    const weeks = [
      ...new Set([
        ...slices.map((x) => weekKey(localDate(x.weekDate))),
        ...data.balanceCorrections.map((item) => item.week),
      ]),
    ]
      .sort()
      .reverse();
    return (
      <>
        {header(
          "TWOJE ROZLICZENIE",
          "Raport pracy",
          "Godziny i zarobki w jednym miejscu.",
          heroAction(
            "Eksportuj CSV",
            "download-outline",
            () => void download("csv"),
          ),
        )}
        <View style={s.segment}>
          {(["summary", "payments"] as const).map((m, i) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: reportMode === m }}
              key={m}
              style={[s.segmentItem, reportMode === m && s.segmentActive]}
              onPress={() => setReportMode(m)}
            >
              <Text
                style={[s.segmentText, reportMode === m && { color: C.text }]}
              >
                {["Podsumowanie", "Rozliczenia"][i]}
              </Text>
            </Pressable>
          ))}
        </View>
        {reportMode === "summary" ? (
          <>
            {weeklyCorrectionBanner()}
            <View style={s.reportHero}>
              <Text style={s.overline}>
                {new Date(now)
                  .toLocaleDateString(locale, {
                    month: "long",
                    year: "numeric",
                  })
                  .toUpperCase()}
              </Text>
              <Text style={s.caption}>Zarobki w tym miesiącu</Text>
              <Text style={s.reportMoney}>{fmt(ms.amount)}</Text>
              <Text style={s.subtitle}>
                {duration(ms.minutes)} h pracy · zapisane zmiany
              </Text>
              <View style={s.reportStats}>
                <View style={{ gap: 7 }}>
                  <Text style={s.caption}>Zwykłe godziny</Text>
                  <Text style={s.summaryValue}>{duration(ms.regular)} h</Text>
                </View>
                <View style={{ gap: 7 }}>
                  <Text style={s.caption}>Nadgodziny</Text>
                  <Text style={[s.summaryValue, { color: C.green }]}>
                    {duration(ms.extra)} h
                  </Text>
                </View>
                <View style={{ gap: 7 }}>
                  <Text style={s.caption}>Dni pracy</Text>
                  <Text style={s.summaryValue}>
                    {
                      new Set(
                        monthSlices
                          .filter((x) => x.minutes > 0)
                          .map((x) => x.date),
                      ).size
                    }
                  </Text>
                </View>
              </View>
              <Text style={[s.caption, { marginTop: 14 }]}>
                Nadgodziny liczymy po przekroczeniu normy tygodniowej dla danego
                miejsca pracy.
              </Text>
            </View>
            {job &&
              (() => {
                const worked =
                  totals(
                    weekSlices.filter((part) => part.entry.jobId === job.id),
                  ).minutes +
                  weeklyCorrectionMinutes(
                    data.balanceCorrections,
                    job.id,
                    week,
                  );
                const target = (job.weeklyHours ?? 40) * 60;
                const remaining = Math.max(0, target - worked);
                return (
                  <View
                    style={[s.card, { marginBottom: 16, padding: 16, gap: 10 }]}
                  >
                    <View style={s.between}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={s.rowTitle}>Norma tygodnia</Text>
                        <Text verbatim style={s.caption}>
                          {job.name}
                        </Text>
                      </View>
                      <Button
                        label="Zmień normę"
                        kind="ghost"
                        small
                        onPress={() => openWeeklyNorm(job)}
                      />
                    </View>
                    <Text style={s.summaryValue}>
                      {duration(worked)} h / {duration(target)} h
                    </Text>
                    <View style={s.progressTrack}>
                      <View
                        style={{
                          width: `${Math.min(100, Math.max(0, (worked / target) * 100))}%`,
                          height: 5,
                          backgroundColor: C.green,
                          borderRadius: 4,
                        }}
                      />
                    </View>
                    <Text style={s.caption}>
                      {worked < 0
                        ? tr(
                            "Korekta jest większa niż suma wpisów. Ustaw stan ponownie.",
                          )
                        : remaining > 0
                          ? `${tr("Do nadgodzin pozostało")} ${duration(remaining)} h`
                          : tr("Norma tygodniowa wykonana")}
                    </Text>
                  </View>
                );
              })()}
            <View style={[s.card, { marginBottom: 20, padding: 18, gap: 16 }]}>
              <Text style={s.sectionTitle}>Dzienne i nocne · ten miesiąc</Text>
              {(
                [
                  { kind: "day", name: "Zmiany dzienne", color: "#C7C9CD" },
                  { kind: "night", name: "Zmiany nocne", color: "#9DAAC0" },
                  {
                    kind: "legacy",
                    name: "Bez przypisanej zmiany",
                    color: C.muted,
                  },
                ] as const
              ).map((item) => {
                const list = monthSlices.filter((x) =>
                    item.kind === "legacy"
                      ? !x.entry.shift
                      : x.entry.shift?.kind === item.kind,
                  ),
                  t = totals(list);
                if (!list.length && item.kind === "legacy") return null;
                return (
                  <View key={item.kind} style={s.between}>
                    <View style={{ gap: 5, flex: 1 }}>
                      <Text
                        style={{
                          color: item.color,
                          fontSize: 13,
                          fontWeight: "600",
                        }}
                      >
                        {item.name}
                      </Text>
                      <Text style={s.caption}>
                        {duration(t.minutes)} h · nadgodziny {duration(t.extra)}{" "}
                        h
                      </Text>
                    </View>
                    <Text style={s.rowMoney}>{fmt(t.amount)}</Text>
                  </View>
                );
              })}
            </View>
            <View style={s.card}>
              <View style={[s.between, { padding: 20 }]}>
                <Text style={s.sectionTitle}>Ten tydzień</Text>
                <Text style={s.caption}>{duration(ws.minutes)} h</Text>
              </View>
              <View style={s.chart}>
                {days.map((d) => (
                  <View key={d.key} style={s.barColumn}>
                    <Text style={s.chartValue}>
                      {d.minutes ? duration(d.minutes) : "—"}
                    </Text>
                    <View style={s.barTrack}>
                      <View
                        style={[
                          s.bar,
                          {
                            height: `${(d.minutes / max) * 100}%`,
                            backgroundColor:
                              d.key === today ? C.green : "#606977",
                            minHeight: d.minutes ? 4 : 0,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[s.caption, d.key === today && { color: C.green }]}
                    >
                      {d.label}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={s.chartFooter}>
                <View style={s.row}>
                  <View
                    style={[
                      s.dot,
                      { backgroundColor: C.green, width: 6, height: 6 },
                    ]}
                  />
                  <Text style={s.caption}>
                    Wykres pokazuje zapisane zmiany, bez korekty salda.
                  </Text>
                </View>
              </View>
            </View>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Wszystkie projekty</Text>
              <Text style={s.caption}>Cały okres</Text>
            </View>
            <View style={s.card}>
              {data.jobs.length ? (
                data.jobs.map((j) => {
                  const t = totals(
                    slices.filter((x) => x.entry.jobId === j.id),
                  );
                  return (
                    <View key={j.id} style={s.projectReport}>
                      <View style={s.between}>
                        <View style={[s.row, { flex: 1, minWidth: 0 }]}>
                          <View style={[s.dot, { backgroundColor: C.muted }]} />
                          <Text
                            verbatim
                            style={[s.rowTitle, { flexShrink: 1 }]}
                          >
                            {j.name}
                          </Text>
                        </View>
                        <Text style={s.rowMoney}>{fmt(t.amount)}</Text>
                      </View>
                      <View style={s.progressTrack}>
                        <View
                          style={{
                            width: `${total.minutes ? (t.minutes / total.minutes) * 100 : 0}%`,
                            height: 5,
                            backgroundColor: C.muted,
                            borderRadius: 4,
                          }}
                        />
                      </View>
                      <Text style={s.caption}>
                        {duration(t.minutes)} h · nadgodziny {duration(t.extra)}{" "}
                        h
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Empty
                  title="Raport czeka na pierwszą zmianę"
                  body="Po zapisaniu pracy zobaczysz tutaj godziny i zarobki."
                />
              )}
            </View>
            <View style={[s.summaryStrip, { marginTop: 20 }]}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={s.caption}>OD POCZĄTKU</Text>
                <Text style={s.summaryMoney}>{fmt(total.amount)}</Text>
              </View>
              <Text style={s.summaryValue}>{duration(total.minutes)} h</Text>
            </View>
            <Text style={s.footnote}>
              Kwoty obliczamy ze stawek zapisanych przy zmianie. Bez podatków i
              potrąceń. Normę tygodniową ustawisz osobno dla miejsca pracy.
            </Text>
          </>
        ) : (
          <>
            <Text style={[s.subtitle, { marginVertical: 18 }]}>
              Tygodniowe okresy od poniedziałku do niedzieli. Oznaczaj otrzymane
              wypłaty, aby łatwiej śledzić rozliczenia.
            </Text>
            {weeks.length ? (
              weeks.map((k) => {
                const t = totals(
                    slices.filter((x) => weekKey(localDate(x.weekDate)) === k),
                  ),
                  weekCorrections = data.balanceCorrections.filter(
                    (item) => item.week === k,
                  ),
                  correction = weekCorrections.reduce(
                    (sum, item) => sum + item.deltaMinutes,
                    0,
                  ),
                  paid = data.paidWeeks.includes(k);
                return (
                  <View key={k} style={[s.paymentCard, { gap: 18 }]}>
                    <View style={s.between}>
                      <View style={{ gap: 8, flex: 1 }}>
                        <Text style={s.rowTitle}>{weekTitle(k, locale)}</Text>
                        <Text style={s.caption}>
                          {duration(t.minutes + correction)} h · nadgodziny{" "}
                          {duration(t.extra)} h
                        </Text>
                        {weekCorrections.length > 0 && (
                          <Text style={s.caption}>
                            Korekta salda bez wynagrodzenia:{" "}
                            {correction < 0 ? "−" : "+"}
                            {duration(Math.abs(correction))} h
                          </Text>
                        )}
                      </View>
                      <Text style={s.rowMoney}>{fmt(t.amount)}</Text>
                    </View>
                    <View style={[s.between, !wide && { flexWrap: "wrap" }]}>
                      <View
                        style={[
                          s.pill,
                          { backgroundColor: paid ? "#292C32" : "#303138" },
                        ]}
                      >
                        <I
                          name={paid ? "checkmark-circle" : "hourglass-outline"}
                          size={13}
                          color={paid ? C.green : "#BCB7AD"}
                        />
                        <Text
                          style={[
                            s.pillText,
                            { color: paid ? C.green : "#BCB7AD" },
                          ]}
                        >
                          {paid ? "Opłacono" : "Do rozliczenia"}
                        </Text>
                      </View>
                      <Button
                        label={
                          paid ? "Cofnij oznaczenie" : "Oznacz jako opłacone"
                        }
                        kind="ghost"
                        small
                        disabled={busy}
                        onPress={() =>
                          void save({
                            ...data,
                            paidWeeks: paid
                              ? data.paidWeeks.filter((w) => w !== k)
                              : [...data.paidWeeks, k],
                          })
                        }
                      />
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={s.card}>
                <Empty
                  icon="wallet-outline"
                  title="Rozliczenia pod kontrolą"
                  body="Okresy rozliczeniowe pojawią się po zapisaniu pierwszej zmiany."
                />
              </View>
            )}
          </>
        )}
      </>
    );
  }
  function settingRow(
    icon: Icon,
    title: string,
    desc: string,
    onPress: () => void,
  ) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={s.settingRow}
      >
        <View style={s.iconTile}>
          <I name={icon} color={C.text} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <Text style={s.rowTitle}>{title}</Text>
          <Text style={s.caption}>{desc}</Text>
        </View>
        <I name="chevron-forward" size={18} />
      </Pressable>
    );
  }
  function requestSampleRemoval() {
    setConfirm({
      title: "Usunąć dane przykładowe?",
      body: `Usuniemy ${samples.size} przykładowych wpisów i nieużywany projekt przykładowy. Twoje własne wpisy, aktywny licznik, stawki i ustawienia zostaną zachowane.`,
      label: "Usuń przykłady",
      danger: true,
      action: () => {
        void save(removeSampleData(data), "Dane przykładowe usunięte").then(
          (ok) => {
            if (ok) setConfirm(null);
          },
        );
      },
    });
  }
  function settings() {
    return (
      <>
        {header(
          "USTAWIENIA",
          "Stawki i zmiany.",
          "Wszystko, czego potrzebujesz do rozliczenia pracy.",
        )}
        {(samples.size > 0 || data.jobs.some((j) => j.demo)) && (
          <View style={[s.card, { padding: 16, gap: 12, marginBottom: 20 }]}>
            <View style={s.row}>
              <I name="information-circle-outline" color={C.green} />
              <Text style={s.rowTitle}>Masz dane przykładowe</Text>
            </View>
            <Text style={s.caption}>
              {samples.size} wpisów do wypróbowania aplikacji. Możesz je usunąć,
              zachowując własną historię.
            </Text>
            <Button
              label="Usuń dane przykładowe"
              icon="trash-outline"
              kind="secondary"
              onPress={requestSampleRemoval}
            />
          </View>
        )}
        <View style={[s.card, { padding: 16, gap: 16, marginBottom: 20 }]}>
          <Text style={s.rowTitle}>Język</Text>
          <View style={s.row}>
            {(
              [
                ["auto", "Automatyczny"],
                ["pl", "Polski"],
                ["en", "English"],
              ] as const
            ).map(([value, label]) => (
              <Chip
                key={value}
                label={label}
                active={(data.language ?? "auto") === value}
                onPress={() =>
                  void save({
                    ...data,
                    language: value === "auto" ? undefined : value,
                  })
                }
              />
            ))}
          </View>
          <Text style={s.caption}>
            Automatyczny wybiera język telefonu: polski albo angielski.
          </Text>
          <Text style={s.rowTitle}>Motyw kolorystyczny</Text>
          <View style={[s.row, { flexWrap: "wrap" }]}>
            {(
              [
                ["emerald", "Szmaragdowy"],
                ["pastel", "Pastelowy"],
                ["navy", "Nocny granat"],
                ["graphite", "Grafit"],
                ["light", "Jasny"],
              ] as const
            ).map(([value, label]) => (
              <Chip
                key={value}
                label={label}
                active={(data.theme ?? "emerald") === value}
                onPress={() => void save({ ...data, theme: value })}
              />
            ))}
          </View>
          <Text style={s.caption}>
            Język, wygląd i wybrana zmiana są zapamiętywane na tym urządzeniu.
          </Text>
        </View>
        <Text style={s.settingsHeading}>STAWKI</Text>
        <View style={{ gap: 12 }}>
          {jobs.map((j) => (
            <Pressable
              key={j.id}
              accessibilityRole="button"
              accessibilityLabel={`Ustawienia projektu ${j.name}`}
              onPress={() => openJob(j)}
              style={[s.card, { padding: 16, gap: 16 }]}
            >
              <View style={s.between}>
                <Text verbatim style={[s.rowTitle, { flexShrink: 1 }]}>
                  {j.name}
                </Text>
                <I name="create-outline" color={C.text} />
              </View>
              <View style={[s.row, { gap: 8 }]}>
                {[
                  { label: "Basic / h", value: fmt(j.rate) },
                  {
                    label: "Allowance",
                    value: `${j.shiftAllowancePercent ?? 0}%`,
                  },
                  {
                    label: "Overtime %",
                    value:
                      policyOvertimePercent(j) === null
                        ? fmt(overtimeHourlyRate(j))
                        : `${Number(policyOvertimePercent(j)!.toFixed(2))}%`,
                  },
                ].map((v) => (
                  <View key={v.label} style={{ flex: 1, gap: 6 }}>
                    <Text style={s.caption}>{v.label}</Text>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[s.rowTitle, { fontSize: 17 }]}
                    >
                      {v.value}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={s.caption}>
                {j.overtimeThreshold === "week"
                  ? "Po normie tygodnia"
                  : j.overtimeThreshold === "both"
                    ? "Zmiana lub tydzień"
                    : "Po normie zmiany"}
                {j.overtimeThreshold && j.overtimeThreshold !== "shift"
                  ? ` · ${duration((j.weeklyHours ?? 40) * 60)} h`
                  : ""}
              </Text>
              <Text style={s.caption}>
                Do normy {fmt(j.rate + allowanceHourlyRate(j))}/h · po normie{" "}
                {fmt(extraHourlyRate(j))}
                /h
              </Text>
            </Pressable>
          ))}
          <Button
            label={
              jobs.length
                ? "Dodaj miejsce pracy"
                : "Ustaw stawki i miejsce pracy"
            }
            icon="add"
            kind={jobs.length ? "secondary" : "primary"}
            onPress={() => openJob()}
          />
        </View>
        <Text style={s.settingsHeading}>PRZERWA</Text>
        <View style={s.card}>
          {settingRow(
            "cafe-outline",
            "Ustaw przerwę",
            `${data.defaultBreakMinutes} min · ${tr(data.automaticBreak ? "Automatycznie" : "Ręcznie")}`,
            openBreakSettings,
          )}
        </View>
        <Text style={s.settingsHeading}>ZMIANY I NORMA</Text>
        <Text style={[s.caption, { marginBottom: 12 }]}>
          Wybierz jedną zmianę na pulpit. Uruchomiony licznik zachowuje swoją
          zmianę do zakończenia.
        </Text>
        <View style={[s.row, { flexWrap: "wrap", marginBottom: 12 }]}>
          {data.shifts.map((v) => (
            <Chip
              key={v.id}
              label={v.name}
              active={data.preferredShiftId === v.id}
              onPress={() =>
                void save(
                  { ...data, preferredShiftId: v.id },
                  "Wybrano zmianę na pulpit",
                )
              }
            />
          ))}
        </View>
        <View style={s.card}>
          {data.shifts.map((v) => (
            <Pressable
              key={v.id}
              accessibilityRole="button"
              accessibilityLabel={`Edytuj: ${v.name}`}
              onPress={() => openShift(v)}
              style={s.settingRow}
            >
              <I
                name={v.kind === "night" ? "moon-outline" : "sunny-outline"}
                color={C.text}
              />
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={s.rowTitle}>{v.name}</Text>
                <Text style={s.caption}>
                  {v.startTime}–{v.endTime}
                  {v.endTime < v.startTime ? " (+1 dzień)" : ""} · norma{" "}
                  {duration(v.normHours * 60)} h
                </Text>
                <Text style={s.caption}>
                  {v.autoStop ? "Automatyczny stop" : "Stop przyciskiem"}
                </Text>
              </View>
              <I name="chevron-forward" size={18} />
            </Pressable>
          ))}
          {settingRow(
            "add-outline",
            "Dodaj własną zmianę",
            "Godziny, norma i sposób zakończenia",
            () => openShift(),
          )}
        </View>
        <Text style={s.settingsHeading}>TWOJE DANE</Text>
        <View style={s.card}>
          {settingRow(
            "download-outline",
            "Zapisz kopię zapasową",
            "Przenieś godziny i stawki w pliku JSON",
            () => void download("json"),
          )}
          {settingRow(
            "document-text-outline",
            "Eksportuj raport CSV",
            "Godziny, dodatki i zarobki",
            () => void download("csv"),
          )}
          {settingRow(
            "cloud-upload-outline",
            "Przywróć z pliku",
            "Wczytaj wcześniej zapisaną kopię",
            () => void restore(),
          )}
          {settingRow(
            "trash-outline",
            "Wyczyść wpisy i projekty",
            `${data.entries.length} wpisów · ${data.jobs.length} miejsc pracy`,
            () => {
              if (timer) {
                setNotice("Najpierw zakończ aktywną zmianę.");
                return;
              }
              setConfirm({
                title: "Wyczyścić ewidencję?",
                body: `Usuniemy wszystkie wpisy, korekty salda, urlopy, projekty i oznaczenia wypłat z tego urządzenia. Zostawimy profile zmian, walutę i ustawienia. Tej operacji nie można cofnąć bez kopii JSON.`,
                label: "Wyczyść ewidencję",
                danger: true,
                action: () => {
                  void save(clearWorkData(data), "Ewidencja wyczyszczona").then(
                    (ok) => {
                      if (ok) {
                        setSelected("");
                        setConfirm(null);
                      }
                    },
                  );
                },
              });
            },
          )}
        </View>
        <Text style={s.footnote}>
          Dane są zapisane na tym urządzeniu. Przed usunięciem lub zmianą
          telefonu zachowaj kopię JSON.
        </Text>
        <Text style={s.settingsHeading}>POZOSTAŁE</Text>
        <View style={s.card}>
          {settingRow(
            "options-outline",
            "Wyświetlanie i waluta",
            "Format czasu, GBP / PLN / EUR",
            () => setPreferencesOpen(!preferencesOpen),
          )}
          {preferencesOpen && (
            <View style={{ padding: 16, gap: 16 }}>
              <Text style={s.rowTitle}>Przypisywanie zmian do dnia</Text>
              <Text style={s.caption}>
                Wybierz, jak kalendarz i podsumowania przypisują zmianę
                przechodzącą przez północ.
              </Text>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Sposób przypisywania zmiany"
                style={{ gap: 8 }}
              >
                {(
                  [
                    {
                      key: "shift",
                      title: "Od rozpoczęcia zmiany",
                      description:
                        "Cała zmiana jest przypisana do dnia rozpoczęcia.",
                    },
                    {
                      key: "midnight",
                      title: "Podział o północy",
                      description: "Godziny i kwoty są dzielone między dni.",
                    },
                  ] as const
                ).map((v) => {
                  const active = (data.countingMode ?? "shift") === v.key;
                  return (
                    <Pressable
                      key={v.key}
                      accessibilityRole="radio"
                      accessibilityLabel={v.title}
                      accessibilityState={{ checked: active }}
                      disabled={busy}
                      onPress={() =>
                        void save({ ...data, countingMode: v.key })
                      }
                      style={[s.row, { minHeight: 56 }]}
                    >
                      <I
                        name={active ? "radio-button-on" : "radio-button-off"}
                        color={active ? C.green : C.muted}
                      />
                      <View style={{ flex: 1, gap: 5 }}>
                        <Text style={s.rowTitle}>{v.title}</Text>
                        <Text style={s.caption}>{v.description}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={s.rowTitle}>Zmiana na przełomie tygodnia</Text>
              <Text style={s.caption}>
                Ustaw, jak liczyć normę tygodniową dla pracy z niedzieli na
                poniedziałek.
              </Text>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Przypisanie do tygodnia"
                style={{ gap: 8 }}
              >
                {(
                  [
                    {
                      key: "midnight",
                      title: "Podziel między tygodnie",
                      description:
                        "Od poniedziałku 00:00 godziny należą do nowego tygodnia.",
                    },
                    {
                      key: "shift",
                      title: "Cała zmiana w tygodniu startu",
                      description:
                        "Godziny po północy należą do tygodnia rozpoczęcia zmiany.",
                    },
                  ] as const
                ).map((v) => {
                  const active = (data.weekBoundary ?? "midnight") === v.key;
                  return (
                    <Pressable
                      key={v.key}
                      accessibilityRole="radio"
                      accessibilityLabel={v.title}
                      accessibilityState={{ checked: active }}
                      disabled={busy}
                      onPress={() => {
                        if (active) return;
                        setConfirm({
                          title: "Zmienić sposób liczenia tygodnia?",
                          body: "Zmiana przeliczy również wcześniejsze i aktywne zmiany przechodzące na nowy tydzień. Kwoty i nadgodziny mogą się zmienić. Korekty salda pozostaną przypisane do wybranych tygodni, a oznaczenia wypłat bez zmian.",
                          label: "Zmień sposób liczenia",
                          action: () => {
                            void save({ ...data, weekBoundary: v.key }).then(
                              (ok) => {
                                if (ok) setConfirm(null);
                              },
                            );
                          },
                        });
                      }}
                      style={[s.row, { minHeight: 56 }]}
                    >
                      <I
                        name={active ? "radio-button-on" : "radio-button-off"}
                        color={active ? C.green : C.muted}
                      />
                      <View style={{ flex: 1, gap: 5 }}>
                        <Text style={s.rowTitle}>{v.title}</Text>
                        <Text style={s.caption}>{v.description}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={s.rowTitle}>Wyświetlanie czasu</Text>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Format czasu pracy"
                style={{ gap: 8 }}
              >
                {(
                  [
                    {
                      key: "clock",
                      title: "Godziny i minuty",
                      example: "3:45 = 3 godz. 45 min",
                    },
                    {
                      key: "decimal",
                      title: "Godziny dziesiętne",
                      example: "3,75 h = 3 godz. 45 min",
                    },
                  ] as const
                ).map((v) => {
                  const active = (data.timeFormat ?? "clock") === v.key;
                  return (
                    <Pressable
                      key={v.key}
                      accessibilityRole="radio"
                      accessibilityLabel={v.title}
                      accessibilityState={{ checked: active }}
                      disabled={busy}
                      onPress={() => void save({ ...data, timeFormat: v.key })}
                      style={[s.row, { minHeight: 56 }]}
                    >
                      <I
                        name={active ? "radio-button-on" : "radio-button-off"}
                        color={active ? C.green : C.muted}
                      />
                      <View style={{ flex: 1, gap: 5 }}>
                        <Text style={s.rowTitle}>{v.title}</Text>
                        <Text style={s.caption}>{v.example}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={s.rowTitle}>Waluta</Text>
              <View style={s.row}>
                {(["GBP", "PLN", "EUR"] as const).map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    active={data.currency === c}
                    onPress={() => {
                      if (c === data.currency) return;
                      setConfirm({
                        title: `Zmienić walutę na ${c}?`,
                        body: "Oznaczenie waluty zmieni się w całej historii. Stawki nie zostaną przeliczone według kursów.",
                        label: "Zmień walutę",
                        action: () => {
                          void save({ ...data, currency: c }).then((ok) => {
                            if (ok) setConfirm(null);
                          });
                        },
                      });
                    }}
                  />
                ))}
              </View>
            </View>
          )}
          {settingRow(
            "folder-outline",
            "Zarządzaj miejscami pracy",
            "Archiwizuj lub usuń wybrany projekt",
            () => setManagementOpen(!managementOpen),
          )}
          {managementOpen &&
            data.jobs.map((j) => (
              <View
                key={j.id}
                style={{
                  padding: 16,
                  gap: 12,
                  borderTopWidth: 1,
                  borderColor: C.line,
                }}
              >
                <Text style={s.rowTitle}>
                  <Text verbatim>{j.name}</Text>
                  {j.archived ? " · archiwum" : ""}
                </Text>
                <Button
                  label={
                    j.archived ? `Przywróć ${j.name}` : `Archiwizuj ${j.name}`
                  }
                  kind="secondary"
                  small
                  onPress={() => {
                    if (timer?.jobId === j.id) {
                      setNotice("Najpierw zakończ aktywną zmianę.");
                      return;
                    }
                    void save(
                      {
                        ...data,
                        jobs: data.jobs.map((x) =>
                          x.id === j.id ? { ...x, archived: !x.archived } : x,
                        ),
                      },
                      j.archived
                        ? "Projekt przywrócony"
                        : "Projekt w archiwum — wpisy zachowane",
                    );
                  }}
                />
                <Button
                  label={`Usuń ${j.name} i wpisy`}
                  kind="danger"
                  small
                  onPress={() => {
                    if (timer?.jobId === j.id) {
                      setNotice("Najpierw zakończ aktywną zmianę.");
                      return;
                    }
                    setConfirm({
                      title: `Usunąć ${j.name}?`,
                      body: `Usuniemy projekt, jego korekty salda oraz ${data.entries.filter((e) => e.jobId === j.id).length} jego wpisów. Inne miejsca pracy zostaną zachowane. Przywrócenie wymaga kopii JSON.`,
                      label: "Usuń projekt i wpisy",
                      danger: true,
                      action: () => {
                        void save(
                          removeJobData(data, j.id),
                          "Projekt i wpisy usunięte",
                        ).then((ok) => {
                          if (ok) setConfirm(null);
                        });
                      },
                    });
                  }}
                />
              </View>
            ))}
          {!data.entries.length &&
            !data.balanceCorrections.length &&
            !timer &&
            settingRow(
              "sparkles-outline",
              "Wypróbuj dane przykładowe",
              "Przykład z możliwością usunięcia",
              () =>
                setConfirm({
                  title: "Wczytać przykład?",
                  body: "Przykład zastąpi obecną listę projektów. To fikcyjne godziny; usuniesz je przyciskiem Usuń dane przykładowe.",
                  label: "Wczytaj przykład",
                  action: () => {
                    void save(
                      {
                        ...demoState(),
                        currency: data.currency,
                        timeFormat: data.timeFormat,
                        countingMode: data.countingMode,
                        weekBoundary: data.weekBoundary,
                        calendarMetric: data.calendarMetric,
                        language: data.language,
                        theme: data.theme,
                      },
                      "Wczytano dane przykładowe",
                    ).then((ok) => {
                      if (ok) {
                        setConfirm(null);
                        setTab("home");
                      }
                    });
                  },
                }),
            )}
        </View>
        {Platform.OS === "web" && (
          <>
            <Text style={s.settingsHeading}>INSTALACJA I OFFLINE</Text>
            <InstallHelp />
          </>
        )}
        <Text style={[s.footnote, { textAlign: "center", marginVertical: 24 }]}>
          Work Hours · 2.0.6 · dane na Twoim urządzeniu
        </Text>
      </>
    );
  }
  const setField = (key: string, value: string) => {
    setFormError("");
    setForm((f) => (f ? { ...f, [key]: value } : f));
  };
  return (
    <View style={[s.app, wide && { paddingTop: insets.top }]}>
      <StatusBar style={wide && lightTheme ? "dark" : "light"} />
      {wide && (
        <View style={s.rail}>
          <View style={[s.row, { marginBottom: 45 }]}>
            <Image
              source={logoMark}
              accessibilityIgnoresInvertColors
              style={s.brandIcon}
            />
            <Text style={s.brandName}>
              work<Text style={{ color: C.green }}>hours</Text>
              <Text style={{ color: C.muted }}> /</Text>
            </Text>
          </View>
          {navigation(true)}
          <View style={s.railBottom}>
            <View
              style={[s.dot, { backgroundColor: C.green, width: 6, height: 6 }]}
            />
            <Text style={s.caption}>Tryb osobisty · offline</Text>
          </View>
        </View>
      )}
      <View style={{ flex: 1 }}>
        {!wide && (
          <View
            style={[
              s.mobileBrand,
              { paddingTop: insets.top + 10, backgroundColor: hero.from },
            ]}
          >
            <View style={s.row}>
              <Image
                source={logoMark}
                accessibilityIgnoresInvertColors
                style={[
                  s.brandIcon,
                  { width: 34, height: 34, borderRadius: 10 },
                ]}
              />
              <View>
                <Text style={[s.heroSubtitle, { fontSize: 12 }]}>
                  {tr(greeting(now))}
                </Text>
                <Text style={[s.brandName, { fontSize: 18, color: "#FFFFFF" }]}>
                  work<Text style={{ color: hero.highlight }}>hours</Text>
                </Text>
              </View>
            </View>
            <View style={s.heroChip}>
              <View
                style={[
                  s.dot,
                  { backgroundColor: hero.highlight, width: 6, height: 6 },
                ]}
              />
              <Text style={s.heroChipText}>OSOBISTE</Text>
            </View>
          </View>
        )}
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            s.content,
            { padding: wide ? 36 : 16, paddingBottom: 40 },
          ]}
        >
          {tab === "home"
            ? home()
            : tab === "entries"
              ? entries()
              : tab === "reports"
                ? reports()
                : settings()}
        </ScrollView>
        {!wide && (
          <View
            style={{
              paddingTop: 6,
              paddingBottom: Math.max(10, insets.bottom),
              backgroundColor: C.bg,
            }}
          >
            {navigation()}
          </View>
        )}
      </View>
      {!!notice && (
        <View
          accessibilityRole="alert"
          style={[s.toast, { bottom: wide ? 24 : 96 + insets.bottom }]}
        >
          <I name="information-circle-outline" color={C.green} />
          <Text
            style={{ color: C.text, flex: 1, fontSize: 13, lineHeight: 19 }}
          >
            {notice}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zamknij komunikat"
            onPress={() => setNotice("")}
          >
            <I name="close" size={18} />
          </Pressable>
        </View>
      )}
      <Modal
        visible={!!form || !!confirm}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!busy) {
            if (confirm) setConfirm(null);
            else setForm(null);
          }
        }}
      >
        {form && !confirm && (
          <KeyboardAvoidingView behavior="padding" style={s.overlay}>
            <View
              style={[
                s.sheet,
                {
                  paddingBottom: Math.max(24, insets.bottom),
                  maxHeight: "92%",
                  marginTop: insets.top,
                },
              ]}
            >
              <View style={s.grabber} />
              <View style={s.sheetHeader}>
                <View style={{ gap: 6, flex: 1 }}>
                  <Text style={s.eyebrow}>WORK HOURS</Text>
                  <Text style={s.sheetTitle}>
                    {form?.type === "weekBalance"
                      ? "Dopasuj stan godzin"
                      : form?.type === "breakSettings"
                        ? "Ustawienia przerwy"
                        : form?.type === "weeklyNorm"
                          ? "Norma tygodniowa"
                          : form?.type === "holidaySettings"
                            ? "Ustawienia urlopu"
                            : form?.type === "holiday"
                              ? form.id
                                ? "Edytuj urlop"
                                : "Dodaj urlop"
                              : form?.type === "shift"
                                ? form.id
                                  ? "Ustawienia zmiany"
                                  : "Własna zmiana"
                                : form?.type === "job"
                                  ? form.id
                                    ? "Edytuj projekt"
                                    : "Nowy projekt"
                                  : form?.type === "stopAt"
                                    ? "Zakończ o wybranej godzinie"
                                    : form?.type === "adjust"
                                      ? "Popraw początek zmiany"
                                      : form?.type === "start"
                                        ? "Rozpocznij od…"
                                        : form?.id
                                          ? "Edytuj wpis"
                                          : "Dodaj przepracowaną zmianę"}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ukryj klawiaturę"
                  onPress={() => Keyboard.dismiss()}
                  style={s.iconTile}
                >
                  <I name="keypad-outline" size={18} color={C.muted} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Zamknij formularz"
                  disabled={busy}
                  onPress={() => setForm(null)}
                  style={s.iconTile}
                >
                  <I name="close" size={20} color={C.muted} />
                </Pressable>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={{ flexShrink: 1 }}
                contentContainerStyle={{ gap: 20, padding: 20 }}
              >
                {form?.type === "weekBalance" ? (
                  <>
                    <Text style={s.rowTitle}>
                      {tr("Tydzień:")} {weekTitle(form.week ?? week, locale)}
                    </Text>
                    <Text style={s.caption}>
                      Wpisz aktualny stan z czytnika po ostatniej zapisanej
                      zmianie, np. 29:28. Uwzględnij zmiany przepracowane po
                      odczycie. Korekta nie tworzy zmiany ani nie zmienia
                      zapisanych zarobków.
                    </Text>
                    <Field
                      label="Stan godzin (godziny:minuty)"
                      placeholder="29:28"
                      time
                      value={form.balance}
                      onChange={(v) => setField("balance", v)}
                    />
                    <Text style={s.caption}>
                      Nowy stan określa, ile brakuje do normy i kiedy rozpoczną
                      się nadgodziny dla kolejnych zmian. Korekta jest zapisana
                      osobno.
                    </Text>
                  </>
                ) : form?.type === "breakSettings" ? (
                  <>
                    <Field
                      label="Domyślna przerwa (minuty)"
                      numeric
                      value={form.minutes}
                      onChange={(v) => setField("minutes", v)}
                    />
                    <Text style={s.fieldLabel}>Sposób rozliczania przerwy</Text>
                    <View style={{ gap: 8 }}>
                      <Chip
                        label="Ręcznie — używam przycisku Przerwa"
                        active={form.automatic !== "true"}
                        onPress={() => setField("automatic", "false")}
                      />
                      <Chip
                        label="Automatycznie po zakończeniu zmiany"
                        active={form.automatic === "true"}
                        onPress={() => setField("automatic", "true")}
                      />
                    </View>
                    <Text style={s.caption}>
                      Ręczny wpis otrzyma proponowaną długość przerwy. W trybie
                      automatycznym po zakończeniu zmiany odliczymy brakujące
                      minuty, jeśli zapisane przerwy są krótsze. Ręczne przerwy
                      nie są liczone podwójnie. Brakujące minuty przypisujemy do
                      końca zmiany. Ustawienie dotyczy nowych uruchomień.
                    </Text>
                    <Text style={s.caption}>
                      Jeśli kilka razy uruchomisz licznik w ramach tej samej
                      zmiany, wcześniejsze przerwy zostaną uwzględnione.
                    </Text>
                    <Text style={s.caption}>
                      Późniejsza ręczna przerwa może zmniejszyć automatycznie
                      odliczoną przerwę we wcześniejszej części tej samej
                      zmiany, a jej kwota zostanie przeliczona.
                    </Text>
                  </>
                ) : form?.type === "weeklyNorm" ? (
                  <>
                    <Field
                      label="Tygodniowa norma (godziny:minuty)"
                      placeholder="np. 37:30"
                      time
                      value={form.weeklyNorm}
                      onChange={(v) => setField("weeklyNorm", v)}
                    />
                    <Text style={s.caption}>
                      Nadgodziny zaczynają się dopiero po normie tygodniowej.
                      Tydzień trwa od poniedziałku do niedzieli.
                    </Text>
                    <Chip
                      label="Przelicz również wcześniejsze wpisy"
                      active={form.recalculateHistory === "true"}
                      onPress={() =>
                        setField(
                          "recalculateHistory",
                          form.recalculateHistory === "true" ? "false" : "true",
                        )
                      }
                    />
                    <Text style={s.caption}>
                      Po zaznaczeniu wcześniejsze wpisy tego miejsca pracy
                      zostaną przeliczone według nowej normy tygodniowej. Ich
                      stawki i przerwy pozostaną bez zmian.
                    </Text>
                  </>
                ) : form?.type === "holidaySettings" ? (
                  <>
                    <Text style={s.caption}>
                      {tr("Ustawienia dla roku")}: {form.year}
                    </Text>
                    <Field
                      label="Roczny limit dni urlopu"
                      numeric
                      value={form.days}
                      onChange={(v) => setField("days", v)}
                    />
                    <Field
                      label="Godziny dnia urlopu (godziny:minuty)"
                      placeholder="09:45"
                      time
                      value={form.hours}
                      onChange={(v) => setField("hours", v)}
                    />
                    <Field
                      label={`Stawka urlopu (${data.currency}/h)`}
                      numeric
                      value={form.rate}
                      onChange={(v) => setField("rate", v)}
                    />
                    <Text style={s.caption}>
                      Limit dotyczy wybranego roku. Godziny i stawka dotyczą
                      nowych urlopów; zapisane dni zachowują swoje wartości.
                    </Text>
                  </>
                ) : form?.type === "holiday" ? (
                  <>
                    <Field
                      label="Data urlopu"
                      placeholder="RRRR-MM-DD"
                      value={form.date}
                      onChange={(v) => setField("date", v)}
                    />
                    <Text style={s.fieldLabel}>Albo wybierz z kalendarza</Text>
                    <DatePicker
                      value={form.date ?? ""}
                      days={form.id ? 1 : Number(form.days) || 1}
                      range={!form.id}
                      onPick={(date, days) => {
                        setFormError("");
                        setForm((f) =>
                          f ? { ...f, date, days: String(days) } : f,
                        );
                      }}
                    />
                    {!form.id && (
                      <>
                        <Field
                          label="Liczba kolejnych dni"
                          numeric
                          value={form.days}
                          onChange={(v) => setField("days", v)}
                        />
                        <Text style={s.caption}>
                          Liczymy kolejne dni kalendarzowe, także weekendy.
                          Jeśli nie chcesz ich uwzględnić, dodaj osobne okresy.
                        </Text>
                      </>
                    )}
                    <Field
                      label="Godziny urlopu (godziny:minuty)"
                      placeholder="08:00"
                      time
                      value={form.hours}
                      onChange={(v) => setField("hours", v)}
                    />
                    <Field
                      label={`Stawka urlopu (${data.currency}/h)`}
                      numeric
                      value={form.rate}
                      onChange={(v) => setField("rate", v)}
                    />
                    <Text style={s.caption}>
                      Możesz wpisać 0 dla urlopu bezpłatnego. Godziny urlopu
                      wliczają się do sumy tygodnia i normy, a kwota urlopu jest
                      podsumowana osobno.
                    </Text>
                  </>
                ) : form?.type === "stopAt" ? (
                  <>
                    <Text style={s.caption}>
                      Wpisz rzeczywistą datę i godzinę zakończenia zmiany.
                    </Text>
                    <View style={s.row}>
                      <Field
                        label="Data zakończenia"
                        placeholder="RRRR-MM-DD"
                        value={form.endDate}
                        onChange={(v) => setField("endDate", v)}
                      />
                      <Field
                        label="Godzina zakończenia"
                        placeholder="03:00"
                        time
                        value={form.endTime}
                        onChange={(v) => setField("endTime", v)}
                      />
                    </View>
                  </>
                ) : form?.type === "adjust" ? (
                  <>
                    <Text style={s.caption}>
                      Ustaw rzeczywistą datę i godzinę rozpoczęcia. Zapisane
                      przerwy pozostaną bez zmian.
                    </Text>
                    <View style={s.row}>
                      <Field
                        label="Data rozpoczęcia"
                        placeholder="RRRR-MM-DD"
                        value={form.startDate}
                        onChange={(v) => setField("startDate", v)}
                      />
                      <Field
                        label="Godzina rozpoczęcia"
                        placeholder="17:30"
                        time
                        value={form.startTime}
                        onChange={(v) => setField("startTime", v)}
                      />
                    </View>
                  </>
                ) : form?.type === "shift" ? (
                  <>
                    <Field
                      label="Nazwa zmiany"
                      value={form.name}
                      onChange={(v) => setField("name", v)}
                      placeholder="np. Zmiana nocna"
                    />
                    <Text style={s.fieldLabel}>Rodzaj zmiany</Text>
                    <View style={s.row}>
                      <Chip
                        label="Dzienna"
                        active={form.kind === "day"}
                        onPress={() => setField("kind", "day")}
                      />
                      <Chip
                        label="Nocna"
                        active={form.kind === "night"}
                        onPress={() => setField("kind", "night")}
                      />
                    </View>
                    <View style={s.row}>
                      <Field
                        label="Początek zmiany"
                        value={form.startTime}
                        onChange={(v) => setField("startTime", v)}
                        placeholder="17:30"
                        time
                      />
                      <Field
                        label="Koniec zmiany"
                        value={form.endTime}
                        onChange={(v) => setField("endTime", v)}
                        placeholder="03:00"
                        time
                      />
                    </View>
                    <Text style={s.caption}>
                      {(form.endTime ?? "") < (form.startTime ?? "")
                        ? "Koniec wypada następnego dnia. Zmiana pozostaje jednym wpisem."
                        : "Godziny początku i końca możesz dopasować do swojego grafiku."}
                    </Text>
                    <Field
                      label="Norma zmiany (godziny:minuty)"
                      value={form.normHours}
                      placeholder="08:00"
                      time
                      onChange={(v) => setField("normHours", v)}
                    />
                    <Text style={s.caption}>
                      Np. 09:45 oznacza 9 godzin 45 minut. Przerwy są odliczane
                      od normy; północ jej nie zeruje.
                    </Text>
                    <Text style={s.fieldLabel}>Zakończenie licznika</Text>
                    <View style={{ gap: 10 }}>
                      <Chip
                        label="Ręcznie — naciskam Stop"
                        active={form.autoStop === "false"}
                        onPress={() => setField("autoStop", "false")}
                      />
                      <Chip
                        label="Automatycznie o godzinie końca"
                        active={form.autoStop === "true"}
                        onPress={() => setField("autoStop", "true")}
                      />
                    </View>
                    <View style={s.tip}>
                      <I name="information-circle-outline" color={C.green} />
                      <Text style={[s.caption, { flex: 1, lineHeight: 20 }]}>
                        {form.autoStop === "true"
                          ? "Czas jest ograniczony ustawionym końcem, także gdy aplikacja jest zamknięta. Po ponownym otwarciu wpis zostanie zapisany z tą godziną. Następna zmiana wymaga naciśnięcia Start."
                          : "Licznik czeka na naciśnięcie Stop. Planowane godziny są wskazówką; możesz pracować krócej lub dłużej."}
                      </Text>
                    </View>
                  </>
                ) : form?.type === "job" ? (
                  <>
                    <Field
                      label="Nazwa projektu lub pracodawcy"
                      value={form.name}
                      onChange={(v) => setField("name", v)}
                      placeholder="Nazwa pracodawcy"
                    />
                    {rateFields()}
                    <Text style={s.caption}>
                      Nowe stawki dotyczą kolejnych zmian. Zapisane wpisy
                      zachowują swoje stawki; możesz je poprawić w edycji wpisu.
                    </Text>
                    {timer?.jobId === form.id && (
                      <Text style={s.caption}>
                        Norma i próg tygodniowy zostaną zastosowane także do
                        trwającej zmiany. Stawki aktywnego zegara pozostaną bez
                        zmian.
                      </Text>
                    )}
                  </>
                ) : (
                  <>
                    {form.type === "start" && (
                      <View style={s.tip}>
                        <I name="information-circle-outline" color={C.green} />
                        <Text style={[s.caption, { flex: 1 }]}>
                          To uruchamia zegar, który będzie dalej liczył czas.
                          Aby wpisać zakończoną zmianę, wybierz przycisk
                          poniżej.
                        </Text>
                      </View>
                    )}
                    {form.type === "start" && (
                      <Button
                        label="Dodaj zakończoną zmianę"
                        icon="create-outline"
                        kind="secondary"
                        onPress={() =>
                          openEntry(undefined, previousLocalDay(now))
                        }
                      />
                    )}
                    {form.type === "entry" &&
                      !!form.id &&
                      (() => {
                        const saved = data.entries.find(
                          (entry) => entry.id === form.id,
                        );
                        return saved ? payDetails(saved) : null;
                      })()}
                    {form.type === "entry" && !form.id && (
                      <>
                        <Text style={s.caption}>
                          Wpisz zakończoną zmianę z dowolnego wcześniejszego
                          dnia. Ten formularz nie uruchamia zegara.
                        </Text>
                        <Text style={s.fieldLabel}>
                          Wybierz dzień rozpoczęcia
                        </Text>
                        <View style={[s.row, { flexWrap: "wrap" }]}>
                          <Button
                            label="Poprzedni dzień"
                            icon="chevron-back"
                            kind="secondary"
                            small
                            onPress={() => {
                              try {
                                selectManualDate(
                                  moveManualDay(form.startDate ?? "", -1),
                                );
                              } catch {
                                selectManualDate(previousLocalDay(now));
                              }
                            }}
                          />
                          <Button
                            label="Następny dzień"
                            icon="chevron-forward"
                            kind="secondary"
                            small
                            onPress={() => {
                              try {
                                selectManualDate(
                                  moveManualDay(form.startDate ?? "", 1),
                                );
                              } catch {
                                selectManualDate(previousLocalDay(now));
                              }
                            }}
                          />
                        </View>
                        <View style={[s.row, { flexWrap: "wrap" }]}>
                          {(
                            [
                              [1, "Wczoraj"],
                              [2, "2 dni temu"],
                              [7, "Tydzień temu"],
                            ] as const
                          ).map(([offset, label]) => (
                            <Chip
                              key={offset}
                              label={label}
                              active={
                                form.startDate === previousLocalDay(now, offset)
                              }
                              onPress={() =>
                                selectManualDate(previousLocalDay(now, offset))
                              }
                            />
                          ))}
                        </View>
                      </>
                    )}
                    <Text style={s.fieldLabel}>Zmiana</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {form.id && form.shiftId === "legacy" && (
                        <Chip
                          label="Bez typu (historyczny)"
                          active
                          onPress={() => {}}
                        />
                      )}
                      {form.id &&
                        form.shiftId !== "legacy" &&
                        !data.shifts.some((x) => x.id === form.shiftId) && (
                          <Chip
                            label="Zapisana zmiana"
                            active
                            onPress={() => {}}
                          />
                        )}
                      {data.shifts.map((x) => (
                        <Chip
                          key={x.id}
                          label={x.name}
                          active={form.shiftId === x.id}
                          onPress={() => selectFormShift(x.id)}
                        />
                      ))}
                    </ScrollView>
                    <Text style={s.fieldLabel}>Projekt</Text>
                    <View style={[s.row, { flexWrap: "wrap" }]}>
                      {data.jobs
                        .filter((j) => !j.archived || j.id === form?.jobId)
                        .map((j) => (
                          <Chip
                            key={j.id}
                            label={j.name}
                            verbatim
                            dot={C.muted}
                            active={form?.jobId === j.id}
                            onPress={() => selectEntryJob(j.id)}
                          />
                        ))}
                    </View>
                    <View style={s.row}>
                      <Field
                        label="Data rozpoczęcia"
                        placeholder="RRRR-MM-DD"
                        value={form?.startDate}
                        onChange={(v) =>
                          form.type === "entry"
                            ? editManualStartDate(v)
                            : setField("startDate", v)
                        }
                      />
                      <Field
                        label="Godzina rozpoczęcia"
                        placeholder="05:40"
                        time
                        value={form?.startTime}
                        onChange={(v) => setField("startTime", v)}
                      />
                    </View>
                    {form?.type === "entry" && (
                      <>
                        <View style={s.row}>
                          <Field
                            label="Data zakończenia"
                            placeholder="RRRR-MM-DD"
                            value={form.endDate}
                            onChange={(v) => {
                              setFormError("");
                              setForm((f) =>
                                f
                                  ? { ...f, endDate: v, endDateEdited: "true" }
                                  : f,
                              );
                            }}
                          />
                          <Field
                            label="Godzina zakończenia"
                            placeholder="16:00"
                            time
                            value={form.endTime}
                            onChange={(v) => setField("endTime", v)}
                          />
                        </View>
                        <Field
                          label="Niepłatna przerwa (minuty)"
                          numeric
                          value={form.breakMinutes}
                          onChange={(v) => setField("breakMinutes", v)}
                        />
                        <Text style={s.caption}>
                          Domyślnie przerwa wynosi 0 minut. Wpisana przerwa jest
                          odejmowana z końca zmiany. Dla nocnej zmiany ustaw
                          datę zakończenia na następny dzień.
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Edytuj stawki tego wpisu"
                          onPress={() =>
                            setField(
                              "ratesExpanded",
                              form.ratesExpanded === "true" ? "false" : "true",
                            )
                          }
                          style={[s.between, { paddingVertical: 10 }]}
                        >
                          <Text style={{ color: C.green, fontSize: 13 }}>
                            Stawki tego wpisu
                          </Text>
                          <I
                            name={
                              form.ratesExpanded === "true"
                                ? "chevron-up"
                                : "chevron-down"
                            }
                            color={C.green}
                          />
                        </Pressable>
                        {form.ratesExpanded === "true" && (
                          <>
                            {rateFields()}
                            <Text style={s.caption}>
                              Zmiana stawek przeliczy wyłącznie ten wpis. Inne
                              zmiany i projekt pozostaną bez zmian.
                            </Text>
                          </>
                        )}
                        <Field
                          label="Notatka (opcjonalnie)"
                          value={form.note}
                          onChange={(v) => setField("note", v)}
                          placeholder="Co udało Ci się zrobić?"
                          multiline
                        />
                      </>
                    )}
                  </>
                )}
                {!!formError && (
                  <Text accessibilityRole="alert" style={s.error}>
                    {formError}
                  </Text>
                )}
                {overlapHelp()}
                <Button
                  label={
                    busy
                      ? "Zapisywanie…"
                      : form?.type === "start"
                        ? "Rozpocznij pracę"
                        : "Zapisz"
                  }
                  icon={form?.type === "start" ? "play" : "checkmark"}
                  onPress={() => {
                    if (
                      form?.type === "weeklyNorm" &&
                      form.recalculateHistory === "true"
                    ) {
                      setConfirm({
                        title: "Przeliczyć wcześniejsze wpisy?",
                        body: "Wcześniejsze wpisy tego miejsca pracy zostaną przeliczone według wpisanej normy tygodniowej. Ich stawki i przerwy pozostaną bez zmian, ale kwoty i oznaczenie nadgodzin mogą się zmienić. Oznaczenia wypłaty pozostaną bez zmian.",
                        label: "Przelicz i zapisz",
                        action: () => {
                          setConfirm(null);
                          void submit();
                        },
                      });
                    } else void submit();
                  }}
                  disabled={busy}
                />
                {form?.type === "shift" &&
                  !!form.id &&
                  data.shifts.length > 1 && (
                    <Button
                      label="Usuń zmianę"
                      kind="danger"
                      icon="trash-outline"
                      disabled={busy}
                      onPress={() => {
                        const id = form.id!;
                        setConfirm({
                          title: "Usunąć tę zmianę?",
                          body: "Usuniemy profil zmiany. Zapisane wpisy i uruchomiony licznik zachowają swoje dane.",
                          label: "Usuń zmianę",
                          danger: true,
                          action: () => {
                            const shifts = data.shifts.filter(
                              (v) => v.id !== id,
                            );
                            void save(
                              {
                                ...data,
                                shifts,
                                preferredShiftId:
                                  data.preferredShiftId === id
                                    ? shifts[0].id
                                    : data.preferredShiftId,
                              },
                              "Zmiana usunięta",
                            ).then((ok) => {
                              if (ok) {
                                setConfirm(null);
                                setForm(null);
                              }
                            });
                          },
                        });
                      }}
                    />
                  )}
                {form?.type === "holiday" && !!form.id && (
                  <Button
                    label="Usuń urlop"
                    kind="danger"
                    icon="trash-outline"
                    disabled={busy}
                    onPress={() => confirmDeleteHoliday(form.id!, true)}
                  />
                )}
                {form?.type === "entry" && !!form.id && (
                  <Button
                    label="Usuń wpis"
                    kind="danger"
                    icon="trash-outline"
                    disabled={busy}
                    onPress={() => {
                      const id = form.id;
                      setConfirm({
                        title: "Usunąć ten wpis?",
                        body: "Wpis zniknie z ewidencji i raportów. Tej operacji nie można cofnąć.",
                        label: "Usuń wpis",
                        danger: true,
                        action: () => {
                          void save(
                            {
                              ...data,
                              entries: data.entries.filter((e) => e.id !== id),
                            },
                            "Wpis usunięty",
                          ).then((ok) => {
                            if (ok) {
                              setConfirm(null);
                              setForm(null);
                            }
                          });
                        },
                      });
                    }}
                  />
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        )}
        {confirm && (
          <View style={[s.overlay, { justifyContent: "center", padding: 24 }]}>
            <View style={[s.confirmBox, { gap: 20 }]}>
              <I
                name={
                  confirm?.danger
                    ? "warning-outline"
                    : "information-circle-outline"
                }
                color={confirm?.danger ? C.red : C.green}
                size={30}
              />
              <Text style={s.sheetTitle}>{confirm?.title}</Text>
              <Text style={[s.subtitle, { lineHeight: 23 }]}>
                {confirm?.body}
              </Text>
              <Button
                label={confirm?.label ?? "Potwierdź"}
                kind={confirm?.danger ? "danger" : "primary"}
                onPress={() => confirm?.action()}
                disabled={busy}
              />
              <Button
                label="Anuluj"
                kind="ghost"
                onPress={() => setConfirm(null)}
                disabled={busy}
              />
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}
function greeting(now: number) {
  const hour = new Date(now).getHours();
  return hour < 12
    ? "Dzień dobry!"
    : hour < 18
      ? "Miłego dnia!"
      : "Dobry wieczór!";
}
function weekTitle(key: string, locale: string) {
  const start = localDate(key),
    end = localDate(key);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${end.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`;
}
const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg, flexDirection: "row" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  content: { width: "100%", maxWidth: 1160, alignSelf: "center" },
  rail: {
    width: 240,
    padding: 24,
    backgroundColor: C.card,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderCurve: "continuous",
    overflow: "hidden",
    boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.18)",
  },
  brandName: {
    color: C.text,
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  railNav: { gap: 8 },
  railItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderCurve: "continuous",
  },
  railBottom: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mobileBrand: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomNav: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    gap: 4,
    marginHorizontal: 20,
    borderRadius: 40,
    borderCurve: "continuous",
    borderWidth: 1,
    boxShadow: "0px 10px 30px rgba(6, 41, 31, 0.35)",
  },
  navItem: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  navItemSelected: { flex: 2.2, paddingHorizontal: 12 },
  navText: { fontSize: 13, fontWeight: "700", letterSpacing: -0.1 },
  shiftInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: C.raised,
  },
  shiftIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.card,
  },
  liveBox: {
    alignItems: "center",
    gap: 2,
    paddingVertical: 6,
  },
  liveClock: {
    fontSize: 44,
    fontWeight: "600",
    letterSpacing: -1,
    color: C.text,
    fontVariant: ["tabular-nums"],
  },
  mainAction: {
    minHeight: 58,
    borderRadius: 29,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  mainActionText: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
    color: "#FFFFFF",
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  tile: {
    minHeight: 92,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 20,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.green + "1A",
  },
  tileText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
    color: C.text,
    textAlign: "center",
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 46,
    overflow: "hidden",
  },
  heroLip: {
    marginHorizontal: -16,
    marginTop: -30,
    marginBottom: 6,
    height: 30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: C.bg,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.6,
    color: "rgba(255, 255, 255, 0.72)",
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: "#FFFFFF",
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 19,
    color: "rgba(255, 255, 255, 0.74)",
  },
  heroNumber: {
    fontSize: 44,
    fontWeight: "600",
    letterSpacing: -1.4,
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
  },
  heroUnit: {
    fontSize: 22,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.6)",
  },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  heroChipText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: "#FFFFFF",
  },
  heroTrack: {
    height: 8,
    marginTop: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  heroButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  pageHeader: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    color: C.muted,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: C.text,
  },
  subtitle: {
    fontSize: 15,
    color: C.muted,
    lineHeight: 20,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    boxShadow:
      "0px 1px 2px rgba(15, 15, 30, 0.04), 0px 8px 24px rgba(15, 15, 30, 0.06)",
  },
  columns: { gap: 16 },
  timerCard: {
    backgroundColor: C.card,
    padding: 22,
    borderRadius: 28,
    borderCurve: "continuous",
    overflow: "hidden",
    boxShadow:
      "0px 1px 2px rgba(15, 15, 30, 0.04), 0px 8px 24px rgba(15, 15, 30, 0.06)",
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  overline: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.3,
    color: C.muted,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  timerTitle: {
    fontSize: 25,
    fontWeight: "600",
    color: C.text,
    marginTop: 17,
    letterSpacing: -0.7,
  },
  timerSub: { fontSize: 12, color: C.muted, marginTop: 7 },
  clock: {
    fontSize: 57,
    fontWeight: "300",
    color: C.text,
    letterSpacing: -2.5,
    marginTop: 20,
    fontVariant: ["tabular-nums"],
  },
  timerHint: { color: C.muted, fontSize: 11, marginTop: 5, marginBottom: 25 },
  button: {
    minHeight: 50,
    borderRadius: 25,
    borderCurve: "continuous",
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  smallButton: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  outlineButton: {
    backgroundColor: C.green + "14",
    borderWidth: 1,
    borderColor: C.green + "59",
  },
  primary: {
    backgroundColor: C.green,
    boxShadow: "0px 4px 14px rgba(0, 0, 0, 0.14)",
  },
  secondary: { backgroundColor: C.raised },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
    flexShrink: 1,
    textAlign: "center",
  },
  startAt: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.raised,
    borderRadius: 24,
  },
  timerFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
  caption: { fontSize: 13, lineHeight: 18, color: C.muted },
  statsColumn: { gap: 14 },
  statCard: {
    padding: 20,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: C.card,
    gap: 14,
    boxShadow:
      "0px 1px 2px rgba(15, 15, 30, 0.04), 0px 8px 24px rgba(15, 15, 30, 0.06)",
  },
  label: { fontSize: 12, color: C.muted },
  bigMoney: {
    fontSize: 37,
    color: C.green,
    fontWeight: "600",
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  pill: {
    backgroundColor: C.green + "1A",
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pillText: { fontSize: 11, color: C.green, fontWeight: "600" },
  statNumber: {
    fontSize: 32,
    color: C.text,
    fontWeight: "500",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  unit: { fontSize: 16, color: C.muted },
  todayMoney: { fontSize: 19, color: C.text, fontWeight: "500" },
  sectionHeader: {
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: C.text,
    letterSpacing: -0.4,
  },
  count: {
    fontSize: 12,
    color: C.muted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: C.raised,
    borderRadius: 999,
    overflow: "hidden",
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 26,
    borderCurve: "continuous",
    overflow: "hidden",
    boxShadow:
      "0px 1px 2px rgba(15, 15, 30, 0.04), 0px 8px 24px rgba(15, 15, 30, 0.06)",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 35,
    paddingHorizontal: 23,
    gap: 15,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    backgroundColor: C.green + "14",
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  emptyTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 15,
    color: C.muted,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 360,
  },
  projectGrid: { gap: 14 },
  projectCard: {
    padding: 18,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: C.card,
    boxShadow:
      "0px 1px 2px rgba(15, 15, 30, 0.04), 0px 8px 24px rgba(15, 15, 30, 0.06)",
  },
  projectIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  rowMoney: {
    fontSize: 15,
    color: C.green,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  projectFooter: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  textLink: { fontSize: 13, color: C.green, fontWeight: "600" },
  entryRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  entryMark: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  dateLabel: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "600",
    paddingTop: 16,
    paddingHorizontal: 16,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tip: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 16,
    marginTop: 20,
    backgroundColor: C.card,
    borderRadius: 20,
    borderCurve: "continuous",
  },
  chip: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.raised,
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipActive: { backgroundColor: C.green + "1F", borderColor: C.green + "59" },
  chips: { gap: 8, paddingVertical: 18 },
  searchBox: {
    backgroundColor: C.raised,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderCurve: "continuous",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    color: C.text,
    fontSize: 16,
    outlineWidth: 0,
  } as any,
  segment: {
    backgroundColor: C.raised,
    padding: 3,
    borderRadius: 12,
    borderCurve: "continuous",
    flexDirection: "row",
    gap: 2,
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 9,
    borderCurve: "continuous",
  },
  segmentActive: {
    backgroundColor: C.card,
    boxShadow:
      "0px 1px 3px rgba(0, 0, 0, 0.12), 0px 3px 8px rgba(0, 0, 0, 0.06)",
  },
  segmentText: { fontSize: 13, color: C.text, fontWeight: "600" },
  summaryStrip: {
    backgroundColor: C.card,
    borderRadius: 22,
    borderCurve: "continuous",
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
    marginVertical: 18,
    boxShadow:
      "0px 1px 2px rgba(15, 15, 30, 0.04), 0px 8px 24px rgba(15, 15, 30, 0.06)",
  },
  summaryMoney: {
    fontSize: 23,
    fontWeight: "600",
    color: C.green,
    letterSpacing: -0.7,
  },
  summaryValue: {
    fontSize: 18,
    color: C.text,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  groupHeader: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#222428",
  },
  groupTitle: { fontSize: 14, color: C.text, fontWeight: "600" },
  groupPreview: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  reportHero: {
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: C.card,
    padding: 20,
    marginVertical: 16,
    gap: 8,
    boxShadow:
      "0px 1px 2px rgba(15, 15, 30, 0.04), 0px 8px 24px rgba(15, 15, 30, 0.06)",
  },
  reportMoney: {
    fontSize: 40,
    color: C.green,
    fontWeight: "700",
    letterSpacing: -1.4,
    marginTop: 3,
    fontVariant: ["tabular-nums"],
  },
  reportStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    paddingTop: 14,
    marginTop: 6,
  },
  chart: {
    height: 190,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 22,
    paddingBottom: 17,
  },
  barColumn: { flex: 1, gap: 10, alignItems: "center" },
  chartValue: { color: C.muted, fontSize: 9 },
  barTrack: {
    flex: 1,
    width: "100%",
    maxWidth: 42,
    justifyContent: "flex-end",
  },
  bar: { borderRadius: 8, borderCurve: "continuous", width: "100%" },
  chartFooter: {
    padding: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  projectReport: {
    padding: 20,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  progressTrack: {
    height: 6,
    backgroundColor: C.raised,
    borderRadius: 3,
    overflow: "hidden",
  },
  footnote: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 18,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  paymentCard: {
    padding: 20,
    backgroundColor: C.card,
    borderRadius: 24,
    borderCurve: "continuous",
    marginBottom: 14,
    boxShadow:
      "0px 1px 2px rgba(15, 15, 30, 0.04), 0px 8px 24px rgba(15, 15, 30, 0.06)",
  },
  privacyCard: {
    padding: 20,
    backgroundColor: C.card,
    borderRadius: 24,
    borderCurve: "continuous",
    flexDirection: "row",
    gap: 16,
    boxShadow:
      "0px 1px 2px rgba(15, 15, 30, 0.04), 0px 8px 24px rgba(15, 15, 30, 0.06)",
  },
  settingsHeading: {
    fontSize: 13,
    letterSpacing: 0.2,
    color: C.muted,
    fontWeight: "500",
    textTransform: "uppercase",
    marginTop: 28,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  settingRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  about: { alignItems: "center", padding: 28, gap: 15 },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    maxWidth: 600,
    alignSelf: "center",
    backgroundColor: C.card,
    padding: 14,
    paddingLeft: 16,
    borderRadius: 22,
    borderCurve: "continuous",
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    zIndex: 200,
    boxShadow:
      "0px 4px 10px rgba(15, 15, 30, 0.08), 0px 18px 40px rgba(15, 15, 30, 0.18)",
  },
  overlay: {
    flex: 1,
    backgroundColor: "#00000066",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    backgroundColor: C.bg,
    width: "100%",
    maxWidth: 560,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderCurve: "continuous",
    overflow: "hidden",
    boxShadow: "0px -8px 40px rgba(0, 0, 0, 0.18)",
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#AFB2BB66",
    alignSelf: "center",
    marginTop: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 16,
  },
  sheetTitle: {
    fontSize: 22,
    color: C.text,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  fieldLabel: {
    fontSize: 13,
    color: C.muted,
    fontWeight: "500",
    paddingHorizontal: 4,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: C.text,
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 14,
    borderCurve: "continuous",
    fontSize: 17,
    minHeight: 50,
  },
  error: {
    padding: 14,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: "#452A29",
    color: C.red,
    fontSize: 14,
    lineHeight: 20,
    overflow: "hidden",
  },
  confirmBox: {
    width: "100%",
    maxWidth: 400,
    padding: 24,
    backgroundColor: C.card,
    borderRadius: 30,
    borderCurve: "continuous",
    boxShadow: "0px 20px 60px rgba(0, 0, 0, 0.25)",
  },
});
