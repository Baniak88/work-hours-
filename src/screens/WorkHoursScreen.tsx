import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Break,
  Entry,
  Job,
  State,
  Shift,
  Slice,
  makeTimer,
  shiftDuration,
  shiftWorkDate,
  validateShift,
  calculate,
  checkEntry,
  csv,
  dateKey,
  demoState,
  duration,
  finishTimer,
  localDate,
  minutesWorked,
  money,
  parseLocal,
  timeLabel,
  timerDayMinutes,
  totals,
  uid,
  validateBackup,
  weekKey,
} from "../domain";
import { useWorkHours } from "../WorkHoursProvider";
import { router } from "expo-router";
import ShiftClock from "../components/ShiftClock";
import { exportFile, importFile } from "../files";

const C = {
  bg: "#101314",
  card: "#1B2021",
  raised: "#252B2D",
  line: "#303638",
  text: "#F4F5F1",
  muted: "#929D9D",
  green: "#B4F272",
  blue: "#8CB8F7",
  red: "#FF9B91",
};
const COLORS = [C.green, C.blue, "#D9AFF7", "#F4C582", "#F29BB5"];
type Icon = React.ComponentProps<typeof Ionicons>["name"];
type Tab = "home" | "entries" | "reports" | "settings";
type Form = {
  type: "job" | "entry" | "start" | "shift";
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
  { key: "entries", label: "Wpisy", icon: "time-outline" },
  { key: "reports", label: "Raporty", icon: "stats-chart-outline" },
  { key: "settings", label: "Więcej", icon: "options-outline" },
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
              ? { backgroundColor: "transparent" }
              : s.secondary,
        { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      {icon && (
        <I
          name={icon}
          color={kind === "primary" ? C.bg : kind === "danger" ? C.red : C.text}
          size={small ? 17 : 20}
        />
      )}
      <Text
        style={[
          s.buttonText,
          {
            color:
              kind === "primary" ? C.bg : kind === "danger" ? C.red : C.text,
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
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  dot?: string;
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
}: {
  label: string;
  value?: string;
  onChange: (s: string) => void;
  placeholder?: string;
  numeric?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value ?? ""}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#657172"
        keyboardType={numeric ? "decimal-pad" : "default"}
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
    [confirm, setConfirm] = useState<Confirm | null>(null);
  const [search, setSearch] = useState(""),
    [projectFilter, setProjectFilter] = useState("all"),
    [shiftFilter, setShiftFilter] = useState("all"),
    [group, setGroup] = useState<"days" | "weeks" | "months" | "jobs">("weeks"),
    [period, setPeriod] = useState("all"),
    [reportMode, setReportMode] = useState<"summary" | "payments">("summary");
  const calculated = useMemo(
    () => calculate(state?.entries ?? []),
    [state?.entries],
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
    weekSlices = slices.filter((x) => weekKey(localDate(x.date)) === week),
    monthSlices = slices.filter((x) => x.date.startsWith(month)),
    ws = totals(weekSlices),
    ms = totals(monthSlices);
  const total = totals(slices),
    todayTotal = totals(slices.filter((x) => x.date === today));
  const fmt = (n: number) => money(n, data.currency);
  const jobFor = (id: string) => data.jobs.find((j) => j.id === id)!;
  function openJob(j?: Job) {
    setFormError("");
    setForm({
      type: "job",
      id: j?.id,
      name: j?.name ?? "",
      rate: String(j?.rate ?? 23.15),
      dailyHours: String(j?.dailyHours ?? 8),
      overtime: String(j?.overtime ?? 1.25),
      color: j?.color ?? C.green,
    });
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
      normHours: String(value?.normHours ?? 8),
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
      };
    });
  }
  function openEntry(e?: Entry) {
    // eslint-disable-next-line react-hooks/purity -- Read on a button press, never while rendering the nested screen helpers.
    const end = e?.end ?? Date.now();
    const start = e?.start ?? end - 8 * 3600000;
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
          : 30,
      ),
      note: e?.note ?? "",
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
  async function start(
    // eslint-disable-next-line react-hooks/purity -- The custom clock's onStart event invokes this handler.
    at = Date.now(),
    id = job?.id,
    shiftId = data.preferredShiftId,
  ) {
    if (!id || timer) return;
    const j = jobFor(id);
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
            data.shifts.find((x) => x.id === shiftId) ?? shift,
            at,
          ),
        },
        "Licznik uruchomiony",
      )
    )
      setForm(null);
  }
  async function togglePause() {
    if (!timer) return;
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
    const entry = finishTimer(timer, end);
    if (
      await save(
        { ...data, timer: null, entries: [...data.entries, entry] },
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
          normHours: Number(form.normHours?.replace(",", ".")),
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
          overtime = Number(form.overtime?.replace(",", "."));
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
          color: form.color ?? C.green,
          archived: data.jobs.find((j) => j.id === form.id)?.archived,
        };
        if (
          await save(
            {
              ...data,
              jobs: form.id
                ? data.jobs.map((x) => (x.id === j.id ? j : x))
                : [...data.jobs, j],
            },
            "Projekt zapisany",
          )
        ) {
          setSelected(j.id);
          setForm(null);
        }
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
      const entry: Entry = {
        id: form.id ?? uid(),
        jobId: id,
        start: startAt,
        end,
        breaks,
        note: form.note?.trim() ?? "",
        rate: policy.rate,
        dailyHours: policy.dailyHours,
        overtime: policy.overtime,
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
      )
        setForm(null);
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
  function row(e: Entry, parts?: Slice[]) {
    const applicable = (parts ?? slices).filter((x) => x.entry.id === e.id);
    const first = applicable[0]?.date,
      last = applicable[applicable.length - 1]?.date;
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
        <View style={[s.entryMark, { backgroundColor: j.color + "19" }]}>
          <I name="briefcase-outline" color={j.color} size={19} />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={s.rowTitle}>{j.name}</Text>
          {e.shift && (
            <Text
              style={{
                fontSize: 10,
                color: e.shift.kind === "night" ? "#AFB7FF" : "#F3CD87",
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
            <Text numberOfLines={1} style={s.caption}>
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
  function header(
    eyebrow: string,
    title: string,
    subtitle: string,
    action?: React.ReactNode,
  ) {
    return (
      <View style={s.pageHeader}>
        <View style={{ flex: 1, gap: 7 }}>
          <Text style={s.eyebrow}>{eyebrow}</Text>
          <Text style={[s.title, !wide && { fontSize: 26 }]}>{title}</Text>
          <Text style={s.subtitle}>{subtitle}</Text>
        </View>
        {action}
      </View>
    );
  }
  const navigation = (rail = false) => (
    <View style={rail ? s.railNav : s.bottomNav}>
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
          ]}
        >
          <I
            name={t.icon}
            size={22}
            color={tab === t.key ? C.green : C.muted}
          />
          <Text
            style={[s.navText, { color: tab === t.key ? C.green : C.muted }]}
          >
            {t.label}
          </Text>
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
  function home() {
    const timerJob = timer ? jobFor(timer.jobId) : job;
    const activeMinutes = timer ? timerDayMinutes(timer, now, today) : 0;
    const target = timer?.shift ?? {
      ...shift,
      workDate: shiftWorkDate(shift, now),
    };
    const prior = totals(
      slices.filter(
        (x) =>
          x.entry.jobId === timerJob?.id &&
          x.entry.shift?.id === target.id &&
          x.entry.shift.workDate === target.workDate,
      ),
    ).minutes;
    return (
      <>
        {header(
          "TWÓJ CZAS. TWOJE ZASADY.",
          "Twój zegar pracy.",
          new Date(now).toLocaleDateString("pl-PL", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          <Pressable
            accessibilityLabel="Ustawienia"
            accessibilityRole="button"
            onPress={() => setTab("settings")}
            style={s.avatar}
          >
            <Text style={{ color: C.green, fontWeight: "700" }}>WH</Text>
          </Pressable>,
        )}
        <View style={[s.columns, wide && { flexDirection: "row" }]}>
          <View style={{ flex: wide ? 1.4 : undefined }}>
            <ShiftClock
              now={now}
              shift={shift}
              shifts={data.shifts}
              timer={timer}
              project={timerJob?.name}
              busy={busy}
              priorMinutes={prior}
              onSelect={(value) =>
                void save({ ...data, preferredShiftId: value.id })
              }
              onEdit={() => openShift(shift)}
              onStart={() => (job ? void start() : openJob())}
              onPause={() => void togglePause()}
              onStop={() => void stop()}
              onStartAt={openStart}
            />
          </View>
          <View style={[s.statsColumn, { flex: wide ? 1 : undefined }]}>
            <View style={[s.statCard, { flex: 1 }]}>
              <View style={s.between}>
                <Text style={s.label}>Zarobki w tym tygodniu</Text>
                <I name="wallet-outline" color={C.green} />
              </View>
              <Text style={s.bigMoney}>{fmt(ws.amount)}</Text>
              <View style={s.row}>
                <View style={s.pill}>
                  <I name="time-outline" color={C.green} size={12} />
                  <Text style={s.pillText}>{duration(ws.minutes)} h</Text>
                </View>
                <Text style={s.caption}>od poniedziałku</Text>
              </View>
            </View>
            <View style={[s.statCard, { flex: 1 }]}>
              <View style={s.between}>
                <Text style={s.label}>Dzisiaj</Text>
                <I name="sunny-outline" color={C.blue} />
              </View>
              <View style={s.between}>
                <Text style={s.statNumber}>
                  {duration(todayTotal.minutes + activeMinutes)}{" "}
                  <Text style={s.unit}>h</Text>
                </Text>
                <Text style={s.todayMoney}>{fmt(todayTotal.amount)}</Text>
              </View>
              <Text style={s.caption}>
                {timer
                  ? "Czas uwzględnia aktywny licznik"
                  : "Zarobki z zapisanych wpisów"}
              </Text>
            </View>
          </View>
        </View>
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
                    Ostatnia zmiana zakończona
                  </Text>
                  <Text style={[s.caption, { marginLeft: "auto" }]}>
                    {timeLabel(last.end)}
                  </Text>
                </View>
                {row(last)}
              </View>
            );
          })()}
        <View style={s.sectionHeader}>
          <View style={s.row}>
            <Text style={s.sectionTitle}>Twoje projekty</Text>
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
                weekSlices.filter((x) => x.entry.jobId === j.id),
              );
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
                          { backgroundColor: j.color + "18" },
                        ]}
                      >
                        <I name="briefcase-outline" color={j.color} />
                      </View>
                      <View style={{ gap: 5, flex: 1 }}>
                        <Text style={s.rowTitle}>{j.name}</Text>
                        <Text style={s.caption}>{fmt(j.rate)} / godz.</Text>
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
                      Ten tydzień · {duration(jt.minutes)} h
                    </Text>
                    <Text style={s.rowMoney}>{fmt(jt.amount)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Ostatnie wpisy</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setTab("entries");
              setProjectFilter("all");
              setPeriod("all");
            }}
          >
            <Text style={s.textLink}>Zobacz wszystkie →</Text>
          </Pressable>
        </View>
        <View style={s.card}>
          {data.entries.length ? (
            [...data.entries]
              .sort((a, b) => b.start - a.start)
              .slice(0, 4)
              .map((e) => (
                <View key={e.id}>
                  <Text style={s.dateLabel}>
                    {new Date(e.start).toLocaleDateString("pl-PL", {
                      weekday: "short",
                      day: "numeric",
                      month: "long",
                    })}
                  </Text>
                  {row(e)}
                </View>
              ))
          ) : (
            <Empty
              title="Tutaj zacznie się Twoja historia"
              body="Uruchom licznik lub dodaj pierwszą zmianę ręcznie."
              action={
                <Button
                  label="Dodaj wpis"
                  icon="add"
                  kind="secondary"
                  onPress={() => (jobs.length ? openEntry() : openJob())}
                />
              }
            />
          )}
        </View>
        <View style={s.tip}>
          <I name="bulb-outline" color={C.green} size={19} />
          <Text style={[s.caption, { flex: 1, lineHeight: 20 }]}>
            Nocna zmiana zachowuje jedną normę godzin, także po północy. Start
            uruchamiasz przy przyjściu; po zakończeniu licznik czeka na Ciebie.
          </Text>
        </View>
      </>
    );
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
          ? weekKey(localDate(x.date))
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
    return (
      <>
        {header(
          "EWIDENCJA PRACY",
          "Twój czas w szczegółach.",
          "Wszystkie zmiany, przerwy i zarobki w jednym miejscu.",
          <Button
            label="Dodaj wpis"
            icon="add"
            small={!wide}
            onPress={() => (jobs.length ? openEntry() : openJob())}
          />,
        )}
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
              dot={j.color}
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
        <View style={s.summaryStrip}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={s.caption}>ZAROBKI</Text>
            <Text style={s.summaryMoney}>{fmt(ft.amount)}</Text>
          </View>
          <View style={{ gap: 5 }}>
            <Text style={s.caption}>CZAS PRACY</Text>
            <Text style={s.summaryValue}>{duration(ft.minutes)} h</Text>
          </View>
          <View style={{ gap: 5 }}>
            <Text style={s.caption}>NADGODZINY</Text>
            <Text style={s.summaryValue}>{duration(ft.extra)} h</Text>
          </View>
        </View>
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
                            ? weekTitle(k)
                            : group === "months"
                              ? localDate(k + "-01").toLocaleDateString(
                                  "pl-PL",
                                  { month: "long", year: "numeric" },
                                )
                              : localDate(k).toLocaleDateString("pl-PL", {
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
                      <Text style={s.caption}>
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
        ...totals(weekSlices.filter((x) => x.date === dateKey(d))),
      };
    });
    const max = Math.max(8 * 60, ...days.map((d) => d.minutes));
    const weeks = [...new Set(slices.map((x) => weekKey(localDate(x.date))))]
      .sort()
      .reverse();
    return (
      <>
        {header(
          "MAŁE MINUTY. DUŻY OBRAZ.",
          "Wiesz, ile pracujesz.",
          "Przegląd godzin, zarobków i tygodniowych rozliczeń.",
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Eksportuj CSV"
            style={s.avatar}
            onPress={() => void download("csv")}
          >
            <I name="download-outline" color={C.green} />
          </Pressable>,
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
            <View style={s.reportHero}>
              <Text style={s.overline}>
                {new Date(now)
                  .toLocaleDateString("pl-PL", {
                    month: "long",
                    year: "numeric",
                  })
                  .toUpperCase()}
              </Text>
              <Text style={s.reportMoney}>{fmt(ms.amount)}</Text>
              <Text style={s.subtitle}>
                {duration(ms.minutes)} godzin pracy w tym miesiącu
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
            </View>
            <View style={[s.card, { marginBottom: 20, padding: 18, gap: 16 }]}>
              <Text style={s.sectionTitle}>Dzienne i nocne · ten miesiąc</Text>
              {(
                [
                  { kind: "day", name: "Zmiany dzienne", color: "#F3CD87" },
                  { kind: "night", name: "Zmiany nocne", color: "#AFB7FF" },
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
                <Text style={s.caption}>{duration(ws.minutes)} / 40 h</Text>
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
                              d.key === today ? C.green : "#46633C",
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
                    Zapisany czas pracy · tydzień od poniedziałku
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
                        <View style={s.row}>
                          <View style={[s.dot, { backgroundColor: j.color }]} />
                          <Text style={s.rowTitle}>{j.name}</Text>
                        </View>
                        <Text style={s.rowMoney}>{fmt(t.amount)}</Text>
                      </View>
                      <View style={s.progressTrack}>
                        <View
                          style={{
                            width: `${total.minutes ? (t.minutes / total.minutes) * 100 : 0}%`,
                            height: 5,
                            backgroundColor: j.color,
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
              potrąceń. Cel wykresu: orientacyjnie 40 godzin tygodniowo.
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
                    slices.filter((x) => weekKey(localDate(x.date)) === k),
                  ),
                  paid = data.paidWeeks.includes(k);
                return (
                  <View key={k} style={[s.paymentCard, { gap: 18 }]}>
                    <View style={s.between}>
                      <View style={{ gap: 8, flex: 1 }}>
                        <Text style={s.rowTitle}>{weekTitle(k)}</Text>
                        <Text style={s.caption}>
                          {duration(t.minutes)} h · nadgodziny{" "}
                          {duration(t.extra)} h
                        </Text>
                      </View>
                      <Text style={s.rowMoney}>{fmt(t.amount)}</Text>
                    </View>
                    <View style={s.between}>
                      <View
                        style={[
                          s.pill,
                          { backgroundColor: paid ? "#263A28" : "#393329" },
                        ]}
                      >
                        <I
                          name={paid ? "checkmark-circle" : "hourglass-outline"}
                          size={13}
                          color={paid ? C.green : "#F4C582"}
                        />
                        <Text
                          style={[
                            s.pillText,
                            { color: paid ? C.green : "#F4C582" },
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
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={s.rowTitle}>{title}</Text>
          <Text style={s.caption}>{desc}</Text>
        </View>
        <I name="chevron-forward" size={18} />
      </Pressable>
    );
  }
  function settings() {
    return (
      <>
        {header(
          "PO TWOJEMU",
          "Twoje miejsce pracy.",
          "Proste ustawienia. Pełna kontrola nad danymi.",
        )}
        <View style={s.privacyCard}>
          <I name="shield-checkmark-outline" size={27} color={C.green} />
          <View style={{ gap: 7, flex: 1 }}>
            <Text style={s.rowTitle}>Twoje dane zostają u Ciebie</Text>
            <Text style={[s.caption, { lineHeight: 21 }]}>
              Aplikacja działa offline, bez konta i reklam. Pamiętaj o
              regularnym zapisywaniu kopii — usunięcie aplikacji może usunąć
              dane.
            </Text>
          </View>
        </View>
        <Text style={s.settingsHeading}>ZMIANY I NORMA GODZIN</Text>
        <View style={{ gap: 12 }}>
          {data.shifts.map((value) => (
            <View key={value.id} style={[s.card, { padding: 18, gap: 15 }]}>
              <View style={s.between}>
                <View style={s.row}>
                  <I
                    name={
                      value.kind === "night" ? "moon-outline" : "sunny-outline"
                    }
                    color={value.kind === "night" ? "#AFB7FF" : "#F3CD87"}
                  />
                  <Text style={s.rowTitle}>{value.name}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edytuj: ${value.name}`}
                  onPress={() => openShift(value)}
                  style={s.iconTile}
                >
                  <I name="create-outline" color={C.text} />
                </Pressable>
              </View>
              <View style={s.between}>
                <Text
                  style={{
                    color: C.text,
                    fontSize: 23,
                    fontWeight: "600",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {value.startTime} – {value.endTime}
                </Text>
                <Text style={s.caption}>
                  {value.endTime < value.startTime ? "+1 dzień · " : ""}
                  {duration(shiftDuration(value))} h
                </Text>
              </View>
              <Text style={s.caption}>
                Norma {duration(value.normHours * 60)} h ·{" "}
                {value.autoStop
                  ? "Automatyczne zakończenie"
                  : "Ręczne zakończenie przyciskiem Stop"}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 14 }}>
          <Button
            label="Dodaj własną zmianę"
            icon="add"
            kind="secondary"
            onPress={() => openShift()}
          />
        </View>
        <Text style={s.footnote}>
          Godziny planu i norma są niezależne. Na zmianie 17:30–03:00 możesz
          mieć normę 8 h. Przerwy są niepłatne; północ nie zeruje normy. Zmiany
          ustawień dotyczą kolejnych uruchomień.
        </Text>
        <Text style={s.settingsHeading}>PREFERENCJE</Text>
        <View style={s.card}>
          <View style={{ padding: 20, gap: 15 }}>
            <View style={s.row}>
              <I name="cash-outline" color={C.blue} />
              <Text style={s.rowTitle}>Waluta</Text>
            </View>
            <View style={s.row}>
              {(["GBP", "PLN", "EUR"] as const).map((c) => (
                <Chip
                  key={c}
                  label={{ GBP: "£ GBP", PLN: "zł PLN", EUR: "€ EUR" }[c]}
                  active={data.currency === c}
                  onPress={() => {
                    if (c === data.currency) return;
                    setConfirm({
                      title: `Zmienić walutę na ${c}?`,
                      body: "Waluta zmieni się we wszystkich projektach i raportach. Wartości stawek pozostaną takie same — aplikacja nie przelicza kursów walut.",
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
        </View>
        <Text style={s.settingsHeading}>DANE I EKSPORT</Text>
        <View style={s.card}>
          {settingRow(
            "download-outline",
            "Eksportuj raport CSV",
            "Wszystkie wpisy, godziny i zarobki",
            () => void download("csv"),
          )}
          {settingRow(
            "cloud-download-outline",
            "Zapisz kopię zapasową",
            "Plik JSON z projektami, wpisami i licznikiem",
            () => void download("json"),
          )}
          {settingRow(
            "cloud-upload-outline",
            "Przywróć z pliku",
            "Przenieś dane lub odzyskaj swoją kopię",
            () => void restore(),
          )}
        </View>
        <Text style={s.settingsHeading}>PROJEKTY</Text>
        <View style={s.card}>
          {data.jobs.map((j) => (
            <View key={j.id} style={s.settingRow}>
              <View style={[s.dot, { backgroundColor: j.color }]} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ustawienia projektu ${j.name}`}
                style={{ flex: 1, gap: 5 }}
                onPress={() => openJob(j)}
              >
                <Text style={s.rowTitle}>
                  {j.name}
                  {j.archived ? " · archiwum" : ""}
                </Text>
                <Text style={s.caption}>
                  {fmt(j.rate)} / godz. · po {j.dailyHours} h ×{j.overtime}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  j.archived
                    ? `Przywróć projekt ${j.name}`
                    : `Archiwizuj projekt ${j.name}`
                }
                style={{ padding: 10 }}
                onPress={() => {
                  if (timer?.jobId === j.id) {
                    setNotice("Zakończ licznik przed archiwizacją projektu.");
                    return;
                  }
                  setConfirm({
                    title: j.archived
                      ? "Przywrócić projekt?"
                      : "Archiwizować projekt?",
                    body: "Wszystkie historyczne wpisy i raporty zostają zachowane.",
                    label: j.archived ? "Przywróć" : "Archiwizuj",
                    action: () => {
                      void save({
                        ...data,
                        jobs: data.jobs.map((x) =>
                          x.id === j.id ? { ...x, archived: !x.archived } : x,
                        ),
                      }).then((ok) => {
                        if (ok) setConfirm(null);
                      });
                    },
                  });
                }}
              >
                <I name={j.archived ? "refresh-outline" : "archive-outline"} />
              </Pressable>
            </View>
          ))}
          {settingRow(
            "add-circle-outline",
            "Dodaj projekt",
            "Osobna stawka i reguły nadgodzin",
            () => openJob(),
          )}
        </View>
        {!data.entries.length && !timer && (
          <>
            <Text style={s.settingsHeading}>SPRAWDŹ MOŻLIWOŚCI</Text>
            <View style={s.card}>
              {settingRow(
                "sparkles-outline",
                "Wypróbuj dane przykładowe",
                "Projekt Bowmill i ostatnie tygodnie pracy",
                () =>
                  setConfirm({
                    title: "Wczytać przykład?",
                    body: "Zastąpi aktualną listę projektów przykładowym projektem Bowmill. Przykładowe wpisy nie przedstawiają Twojej rzeczywistej pracy.",
                    label: "Wczytaj przykład",
                    action: () => {
                      void save(demoState(), "Wczytano dane przykładowe").then(
                        (ok) => {
                          if (ok) {
                            setConfirm(null);
                            setTab("home");
                          }
                        },
                      );
                    },
                  }),
              )}
            </View>
          </>
        )}
        <View style={s.about}>
          <View style={s.row}>
            <View style={s.brandIcon}>
              <I name="time" color={C.bg} size={20} />
            </View>
            <Text style={s.brandName}>
              work<Text style={{ color: C.green }}>hours</Text>
              <Text style={{ color: C.muted }}> /</Text>
            </Text>
          </View>
          <Text style={s.caption}>
            Wersja 1.1.0 · Zrobione dla Twojego czasu
          </Text>
          <Text style={s.footnote}>
            Nowe zmiany zachowują jedną normę także przez północ. Starsze wpisy
            zachowują reguły dzienne. Zmiana stawek dotyczy nowych wpisów.
            Status „opłacono” jest Twoim oznaczeniem, nie potwierdzeniem
            przelewu.
          </Text>
        </View>
      </>
    );
  }
  const setField = (key: string, value: string) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));
  return (
    <View style={[s.app, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      {wide && (
        <View style={s.rail}>
          <View style={[s.row, { marginBottom: 45 }]}>
            <View style={s.brandIcon}>
              <I name="time" size={22} color={C.bg} />
            </View>
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
          <View style={s.mobileBrand}>
            <View style={s.row}>
              <View
                style={[
                  s.brandIcon,
                  { width: 27, height: 27, borderRadius: 8 },
                ]}
              >
                <I name="time" size={18} color={C.bg} />
              </View>
              <Text style={[s.brandName, { fontSize: 18 }]}>
                work<Text style={{ color: C.green }}>hours</Text>
                <Text style={{ color: C.muted }}> /</Text>
              </Text>
            </View>
            <View style={s.row}>
              <View
                style={[
                  s.dot,
                  { backgroundColor: C.green, width: 5, height: 5 },
                ]}
              />
              <Text style={[s.caption, { fontSize: 11 }]}>OSOBISTE</Text>
            </View>
          </View>
        )}
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            s.content,
            { padding: wide ? 36 : 20, paddingBottom: 40 },
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
              paddingBottom: Math.max(8, insets.bottom),
              backgroundColor: C.bg,
              borderTopWidth: 1,
              borderTopColor: C.line,
            }}
          >
            {navigation()}
          </View>
        )}
      </View>
      {!!notice && (
        <View
          accessibilityRole="alert"
          style={[s.toast, { bottom: wide ? 24 : 90 + insets.bottom }]}
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
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={s.overlay}
          >
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
              <View style={s.sheetHeader}>
                <View style={{ gap: 6, flex: 1 }}>
                  <Text style={s.eyebrow}>WORK HOURS</Text>
                  <Text style={s.sheetTitle}>
                    {form?.type === "shift"
                      ? form.id
                        ? "Ustawienia zmiany"
                        : "Własna zmiana"
                      : form?.type === "job"
                        ? form.id
                          ? "Edytuj projekt"
                          : "Nowy projekt"
                        : form?.type === "start"
                          ? "Rozpocznij od…"
                          : form?.id
                            ? "Edytuj wpis"
                            : "Dodaj wpis"}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Zamknij formularz"
                  disabled={busy}
                  onPress={() => setForm(null)}
                  style={s.iconTile}
                >
                  <I name="close" color={C.text} />
                </Pressable>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 22, padding: 24 }}
              >
                {form?.type === "shift" ? (
                  <>
                    <Field
                      label="Nazwa zmiany"
                      value={form.name}
                      onChange={(v) => setField("name", v)}
                      placeholder="np. Nocna w Bowmill"
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
                      />
                      <Field
                        label="Koniec zmiany"
                        value={form.endTime}
                        onChange={(v) => setField("endTime", v)}
                        placeholder="03:00"
                      />
                    </View>
                    <Text style={s.caption}>
                      {(form.endTime ?? "") < (form.startTime ?? "")
                        ? "Koniec wypada następnego dnia. Zmiana pozostaje jednym wpisem."
                        : "Godziny początku i końca możesz dopasować do swojego grafiku."}
                    </Text>
                    <Field
                      label="Norma godzin na zmianę"
                      numeric
                      value={form.normHours}
                      onChange={(v) => setField("normHours", v)}
                    />
                    <Text style={s.caption}>
                      Np. 8 lub 7,5. Nadgodziny zaczynają się po przepracowaniu
                      normy, po odjęciu przerw. Nie zerują się o północy.
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
                      placeholder="np. Bowmill"
                    />
                    <Field
                      label={`Stawka godzinowa (${data.currency})`}
                      value={form.rate}
                      numeric
                      onChange={(v) => setField("rate", v)}
                    />
                    <View style={s.row}>
                      <Field
                        label="Limit starszych wpisów (h / dzień)"
                        value={form.dailyHours}
                        numeric
                        onChange={(v) => setField("dailyHours", v)}
                      />
                      <Field
                        label="Mnożnik nadgodzin"
                        value={form.overtime}
                        numeric
                        onChange={(v) => setField("overtime", v)}
                      />
                    </View>
                    <Text style={s.caption}>
                      Mnożnik dotyczy nadgodzin tego projektu. Normę nowych
                      zmian ustawisz w profilach zmian dziennych i nocnych.
                      Dzienny limit zachowujemy dla starszych wpisów bez typu
                      zmiany.
                    </Text>
                    <Text style={s.fieldLabel}>Kolor projektu</Text>
                    <View style={s.row}>
                      {COLORS.map((c) => (
                        <Pressable
                          key={c}
                          accessibilityRole="button"
                          accessibilityLabel={`Kolor ${c}`}
                          onPress={() => setField("color", c)}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: c,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {form.color === c && (
                            <I name="checkmark" color={C.bg} />
                          )}
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
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
                            dot={j.color}
                            active={form?.jobId === j.id}
                            onPress={() => setField("jobId", j.id)}
                          />
                        ))}
                    </View>
                    <View style={s.row}>
                      <Field
                        label="Data rozpoczęcia"
                        placeholder="RRRR-MM-DD"
                        value={form?.startDate}
                        onChange={(v) => setField("startDate", v)}
                      />
                      <Field
                        label="Godzina rozpoczęcia"
                        placeholder="05:40"
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
                            onChange={(v) => setField("endDate", v)}
                          />
                          <Field
                            label="Godzina zakończenia"
                            placeholder="16:00"
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
                          Ręczna przerwa jest odejmowana z końca zmiany. Dla
                          nocnej zmiany ustaw datę zakończenia na następny
                          dzień.
                        </Text>
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
                <Button
                  label={
                    busy
                      ? "Zapisywanie…"
                      : form?.type === "start"
                        ? "Rozpocznij pracę"
                        : "Zapisz"
                  }
                  icon={form?.type === "start" ? "play" : "checkmark"}
                  onPress={() => void submit()}
                  disabled={busy}
                />
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
function weekTitle(key: string) {
  const start = localDate(key),
    end = localDate(key);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString("pl-PL", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })}`;
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
  rail: { width: 226, padding: 25, borderRightWidth: 1, borderColor: C.line },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    color: C.text,
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  railNav: { gap: 8 },
  railItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  railBottom: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mobileBrand: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomNav: { flexDirection: "row", paddingTop: 14, paddingHorizontal: 8 },
  navItem: { flex: 1, alignItems: "center", gap: 6, paddingBottom: 4 },
  navText: { fontSize: 12, fontWeight: "500" },
  pageHeader: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    marginBottom: 27,
    marginTop: 12,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.7,
    color: C.green,
  },
  title: {
    fontSize: 29,
    fontWeight: "700",
    letterSpacing: -1.1,
    color: C.text,
  },
  subtitle: { fontSize: 13, color: C.muted, lineHeight: 20 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  columns: { gap: 16 },
  timerCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "#3A4930",
    padding: 23,
    borderRadius: 22,
    overflow: "hidden",
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  overline: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.3,
    color: C.muted,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 11,
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
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  smallButton: { minHeight: 36, paddingHorizontal: 10, paddingVertical: 9 },
  primary: { backgroundColor: C.green },
  secondary: { backgroundColor: C.raised, borderWidth: 1, borderColor: C.line },
  buttonText: { fontSize: 13, fontWeight: "600" },
  startAt: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.raised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  timerFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  caption: { fontSize: 11, color: C.muted },
  statsColumn: { gap: 14 },
  statCard: { padding: 21, borderRadius: 20, backgroundColor: C.card, gap: 15 },
  label: { fontSize: 12, color: C.muted },
  bigMoney: {
    fontSize: 37,
    color: C.green,
    fontWeight: "600",
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  pill: {
    backgroundColor: "#2B3826",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pillText: { fontSize: 10, color: C.green, fontWeight: "600" },
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
    marginTop: 27,
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: C.text,
    letterSpacing: -0.4,
  },
  count: {
    fontSize: 11,
    color: C.muted,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: C.raised,
    borderRadius: 6,
  },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "#2A3031",
    borderRadius: 18,
    overflow: "hidden",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 35,
    paddingHorizontal: 23,
    gap: 15,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    backgroundColor: "#2B3826",
    borderRadius: 18,
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
    fontSize: 13,
    color: C.muted,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 360,
  },
  projectGrid: { gap: 14 },
  projectCard: {
    padding: 17,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
  },
  projectIcon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { color: C.text, fontSize: 14, fontWeight: "600" },
  rowMoney: {
    fontSize: 15,
    color: C.green,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  projectFooter: {
    marginTop: 17,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  textLink: { fontSize: 11, color: C.green, fontWeight: "500" },
  entryRow: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  entryMark: {
    width: 37,
    height: 37,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  dateLabel: {
    color: C.muted,
    fontSize: 10,
    paddingTop: 15,
    paddingHorizontal: 16,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tip: {
    flexDirection: "row",
    gap: 11,
    alignItems: "center",
    padding: 17,
    marginTop: 20,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
  },
  chip: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
  },
  chipActive: { backgroundColor: C.raised, borderColor: "#718060" },
  chips: { gap: 8, paddingVertical: 18 },
  searchBox: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 15,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 15,
    color: C.text,
    fontSize: 13,
    outlineWidth: 0,
  } as any,
  segment: {
    backgroundColor: C.card,
    padding: 5,
    borderRadius: 12,
    flexDirection: "row",
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 8,
  },
  segmentActive: { backgroundColor: "#343C3B" },
  segmentText: { fontSize: 12, color: C.muted, fontWeight: "600" },
  summaryStrip: {
    backgroundColor: "#20291D",
    borderWidth: 1,
    borderColor: "#35452C",
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
    marginVertical: 20,
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
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#22292A",
  },
  groupTitle: { fontSize: 14, color: C.text, fontWeight: "600" },
  groupPreview: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  reportHero: {
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 25,
    marginVertical: 20,
    gap: 12,
  },
  reportMoney: {
    fontSize: 45,
    color: C.green,
    fontWeight: "600",
    letterSpacing: -1.8,
    marginTop: 3,
  },
  reportStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    borderTopWidth: 1,
    borderColor: C.line,
    paddingTop: 22,
    marginTop: 8,
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
  bar: { borderRadius: 6, width: "100%" },
  chartFooter: { padding: 18, borderTopWidth: 1, borderColor: C.line },
  projectReport: {
    padding: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  progressTrack: {
    height: 5,
    backgroundColor: C.raised,
    borderRadius: 4,
    overflow: "hidden",
  },
  footnote: { fontSize: 11, color: C.muted, lineHeight: 20, marginTop: 12 },
  paymentCard: {
    padding: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 17,
    marginBottom: 14,
  },
  privacyCard: {
    padding: 22,
    backgroundColor: "#20291D",
    borderWidth: 1,
    borderColor: "#35452C",
    borderRadius: 17,
    flexDirection: "row",
    gap: 17,
  },
  settingsHeading: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: C.muted,
    fontWeight: "600",
    marginTop: 28,
    marginBottom: 13,
  },
  settingRow: {
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  about: { alignItems: "center", padding: 28, gap: 15 },
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    maxWidth: 600,
    alignSelf: "center",
    backgroundColor: "#303D2A",
    borderWidth: 1,
    borderColor: "#5F754B",
    padding: 16,
    borderRadius: 13,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    zIndex: 200,
  },
  overlay: {
    flex: 1,
    backgroundColor: "#000000B8",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    backgroundColor: C.card,
    width: "100%",
    maxWidth: 560,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    borderWidth: 1,
    borderColor: C.line,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 24,
    gap: 16,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  sheetTitle: {
    fontSize: 23,
    color: C.text,
    fontWeight: "600",
    letterSpacing: -0.7,
  },
  fieldLabel: { fontSize: 12, color: "#BFC8C5", fontWeight: "500" },
  input: {
    padding: 14,
    color: C.text,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 11,
    fontSize: 15,
    minHeight: 49,
  },
  error: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#452A29",
    color: C.red,
    fontSize: 13,
    lineHeight: 21,
  },
  confirmBox: {
    width: "100%",
    maxWidth: 430,
    padding: 26,
    backgroundColor: C.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
  },
});
