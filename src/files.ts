import { Platform } from "react-native";
import * as FS from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
export async function exportFile(name: string, content: string, type: string) {
  if (Platform.OS === "web") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const path = FS.cacheDirectory + name;
  await FS.writeAsStringAsync(path, content);
  if (!(await Sharing.isAvailableAsync()))
    throw new Error(
      "Udostępnianie plików nie jest dostępne na tym urządzeniu.",
    );
  await Sharing.shareAsync(path, {
    mimeType: type,
    UTI:
      type === "application/json"
        ? "public.json"
        : "public.comma-separated-values-text",
  });
}
export async function importFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const file = result.assets[0];
  if ((file.size ?? 0) > 20 * 1024 * 1024)
    throw new Error("Kopia jest zbyt duża (maksymalnie 20 MB).");
  if (Platform.OS === "web") return await (await fetch(file.uri)).text();
  return FS.readAsStringAsync(file.uri);
}
