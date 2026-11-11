import AsyncStorage from "@react-native-async-storage/async-storage";
import { freshState, State, validateBackup } from "./domain";
const KEY = "work-hours:v1";
let queue: Promise<void> = Promise.resolve();
export async function readState(): Promise<State> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw === null ? freshState() : validateBackup(JSON.parse(raw));
}
// The previous snapshot remains intact if a write fails; concurrent actions are serialized.
export function writeState(state: State) {
  const next = queue
    .catch(() => {})
    .then(() => AsyncStorage.setItem(KEY, JSON.stringify(state)));
  queue = next;
  return next;
}
