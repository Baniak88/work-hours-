import {
  State,
  Entry,
  dateKey,
  defaultShifts,
  localDate,
  weekKey,
  calculate,
} from "./domain";

// Releases through 1.3 did not mark examples. Match their complete generated
// fingerprint, including creation date and original shift, rather than the name alone.
function legacySample(state: State, e: Entry) {
  const job = state.jobs.find((j) => j.id === e.jobId);
  if (
    !job ||
    job.name !== "Bowmill" ||
    e.rate !== 23.15 ||
    e.dailyHours !== 8 ||
    e.overtime !== 1.25 ||
    e.overtimeMode !== undefined ||
    (e.shiftAllowancePercent ?? 0) !== 0 ||
    !e.shift
  )
    return false;
  const created = Number.parseInt(job.id.split("-")[0], 36);
  const entryCreated = Number.parseInt(e.id.split("-")[0], 36);
  if (
    !Number.isFinite(created) ||
    !Number.isFinite(entryCreated) ||
    entryCreated < created ||
    entryCreated - created > 30000
  )
    return false;
  for (let i = 1; i <= 26; i++) {
    const date = new Date(created);
    date.setDate(date.getDate() - i);
    if ([0, 6].includes(date.getDay())) continue;
    const shift = defaultShifts()[i % 3 === 0 ? 1 : 0];
    const night = shift.kind === "night";
    date.setHours(night ? 17 : 5, night ? 30 : 40 + (i % 4), 0, 0);
    const end = new Date(date);
    if (night) end.setDate(end.getDate() + 1);
    end.setHours(night ? 3 : 16, 0, 0, 0);
    if (
      e.start === date.getTime() &&
      e.end === end.getTime() &&
      e.note === (i % 4 === 0 ? "Zmiana poranna" : "") &&
      e.breaks.length === 1 &&
      e.breaks[0].start === e.start + 4 * 3600000 &&
      e.breaks[0].end === e.start + 4.5 * 3600000 &&
      e.shift.id === shift.id &&
      e.shift.workDate === dateKey(date) &&
      e.shift.name === shift.name &&
      e.shift.kind === shift.kind &&
      e.shift.startTime === shift.startTime &&
      e.shift.endTime === shift.endTime &&
      e.shift.normHours === 8 &&
      e.shift.autoStop === false
    )
      return true;
  }
  return false;
}
export function sampleEntryIds(state: State) {
  return new Set(
    state.entries
      .filter((e) => e.demo === true || legacySample(state, e))
      .map((e) => e.id),
  );
}
export function removeSampleData(state: State): State {
  const ids = sampleEntryIds(state);
  const sampleJobs = new Set(
    state.jobs
      .filter(
        (j) =>
          j.demo ||
          state.entries.some((e) => e.jobId === j.id && ids.has(e.id)),
      )
      .map((j) => j.id),
  );
  const entries = state.entries.filter((e) => !ids.has(e.id));
  const referenced = new Set([
    ...entries.map((e) => e.jobId),
    ...state.balanceCorrections.map((item) => item.jobId),
    ...(state.timer ? [state.timer.jobId] : []),
  ]);
  const jobs = state.jobs
    .filter((j) => !sampleJobs.has(j.id) || referenced.has(j.id))
    .map((j) => ({ ...j, demo: undefined }));
  const keptIds = new Set(jobs.map((job) => job.id));
  const balanceCorrections = state.balanceCorrections.filter((item) =>
    keptIds.has(item.jobId),
  );
  const occupiedWeeks = new Set([
    ...calculate(
      entries,
      state.weekBoundary ?? "midnight",
      balanceCorrections,
    ).map((s) => weekKey(localDate(s.weekDate))),
    ...balanceCorrections.map((item) => item.week),
  ]);
  return {
    ...state,
    jobs,
    entries,
    balanceCorrections,
    paidWeeks: state.paidWeeks.filter((w) => occupiedWeeks.has(w)),
  };
}
export function clearWorkData(state: State): State {
  if (state.timer) throw new Error("Najpierw zakończ aktywną zmianę.");
  return {
    ...state,
    jobs: [],
    entries: [],
    holidays: [],
    balanceCorrections: [],
    timer: null,
    paidWeeks: [],
  };
}
export function removeJobData(state: State, jobId: string): State {
  if (state.timer?.jobId === jobId)
    throw new Error("Najpierw zakończ zmianę w tym miejscu pracy.");
  const entries = state.entries.filter((e) => e.jobId !== jobId);
  const balanceCorrections = state.balanceCorrections.filter(
    (item) => item.jobId !== jobId,
  );
  const weeks = new Set([
    ...calculate(
      entries,
      state.weekBoundary ?? "midnight",
      balanceCorrections,
    ).map((s) => weekKey(localDate(s.weekDate))),
    ...balanceCorrections.map((item) => item.week),
  ]);
  return {
    ...state,
    jobs: state.jobs.filter((j) => j.id !== jobId),
    entries,
    balanceCorrections,
    paidWeeks: state.paidWeeks.filter((w) => weeks.has(w)),
  };
}

export function markLegacySamples(state: State): State {
  const ids = sampleEntryIds(state);
  if (!state.entries.some((e) => ids.has(e.id) && !e.demo)) return state;
  return {
    ...state,
    entries: state.entries.map((e) =>
      ids.has(e.id) ? { ...e, demo: true } : e,
    ),
  };
}
