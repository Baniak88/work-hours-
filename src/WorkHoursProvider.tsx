import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import {
  State,
  normalizeWeeklyOvertime,
  settleTimer,
  syncTimerBreakContext,
  timeLabel,
} from "./domain";
import { readState, writeState } from "./storage";

type Store = {
  state: State | null;
  loadError: string;
  load: () => Promise<void>;
  now: number;
  busy: boolean;
  notice: string;
  setNotice: React.Dispatch<React.SetStateAction<string>>;
  selected: string;
  setSelected: React.Dispatch<React.SetStateAction<string>>;
  save: (next: State, message?: string) => Promise<boolean>;
};
const Context = createContext<Store | null>(null);
export function WorkHoursProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State | null>(null),
    [loadError, setLoadError] = useState(""),
    [now, setNow] = useState(() => Date.now()),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState("");
  const current = useRef<State | null>(null),
    lock = useRef(false);
  const load = useCallback(async () => {
    try {
      const stored = await readState();
      setLoadError("");
      const withBreakContext = syncTimerBreakContext(
        normalizeWeeklyOvertime(stored),
      );
      const ready = settleTimer(withBreakContext, Date.now());
      if (ready !== stored) {
        await writeState(ready);
      }
      if (ready !== withBreakContext) {
        setNotice(
          `Zmiana zakończona automatycznie o ${timeLabel(stored.timer!.plannedEnd!)}.`,
        );
      }
      current.current = ready;
      setState(ready);
    } catch {
      setLoadError(
        "Nie udało się odczytać zapisanych danych. Zachowaliśmy je na urządzeniu. Spróbuj ponownie.",
      );
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydration updates state after the asynchronous AsyncStorage read.
    void load();
    const interval = setInterval(() => setNow(Date.now()), 1000);
    const listener = AppState.addEventListener("change", () =>
      setNow(Date.now()),
    );
    return () => {
      clearInterval(interval);
      listener.remove();
    };
  }, [load]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);
  const save = useCallback(
    async (next: State, message?: string) => {
      if (lock.current) return false;
      // An old confirmation must not restore an expired timer or discard a new entry.
      if (current.current !== state) {
        setNotice("Dane zostały uaktualnione. Otwórz ponownie tę operację.");
        return false;
      }
      lock.current = true;
      setBusy(true);
      try {
        const withBreakContext = syncTimerBreakContext(
          normalizeWeeklyOvertime(next),
        );
        const committed = settleTimer(withBreakContext, Date.now());
        await writeState(committed);
        current.current = committed;
        setState(committed);
        if (committed !== withBreakContext)
          setNotice(
            `Zmiana zakończona automatycznie o ${timeLabel(next.timer!.plannedEnd!)}.`,
          );
        else if (message) setNotice(message);
        return true;
      } catch {
        setNotice(
          "Nie udało się zapisać danych. Sprawdź wolne miejsce i spróbuj ponownie.",
        );
        return false;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [state],
  );
  useEffect(() => {
    if (
      state?.timer?.plannedEnd &&
      now >= state.timer.plannedEnd &&
      !lock.current
    )
      void save(state);
  }, [state, now, save]);
  return (
    <Context.Provider
      value={{
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
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWorkHours() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkHoursProvider is missing");
  return value;
}
