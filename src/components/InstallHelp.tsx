import { Text, View, Icon as Ionicons } from "../ui";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet } from "react-native";

export default function InstallHelp() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web" || !("serviceWorker" in navigator)) return;
    let mounted = true;
    void navigator.serviceWorker.ready.then(() => {
      if (mounted) setReady(true);
    });
    const error = () => setFailed(true);
    window.addEventListener("workhours:offline-error", error);
    return () => {
      mounted = false;
      window.removeEventListener("workhours:offline-error", error);
    };
  }, []);
  if (Platform.OS !== "web") return null;
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Ionicons
          name="phone-portrait-outline"
          size={22}
          color="#DCE2EA"
          accessible={false}
        />
        <Text style={s.title}>Zainstaluj na iPhonie</Text>
      </View>
      <Text style={s.body}>
        Otwórz w Safari → Udostępnij → Do ekranu początkowego → Dodaj. Jeśli
        widzisz opcję „Otwórz jako aplikację”, włącz ją.
      </Text>
      <Text
        accessibilityLiveRegion="polite"
        style={[s.status, ready && { color: "#DCE2EA" }]}
      >
        {ready
          ? "✓ Gotowa do pracy offline na tym urządzeniu"
          : failed
            ? "Brak zapisu offline. Połącz się z internetem i otwórz ponownie."
            : "Przy pierwszym otwarciu pozostaw połączenie, aż pojawi się potwierdzenie pracy offline."}
      </Text>
      <Text style={s.body}>
        Uruchom ikonę po dodaniu i poczekaj na potwierdzenie offline. Dane
        zapisują się na tym urządzeniu. Przenieś historię z Androida przez kopię
        JSON.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: "#1C1D20",
    boxShadow:
      "0px 1px 2px rgba(15, 15, 30, 0.04), 0px 8px 24px rgba(15, 15, 30, 0.06)",
    gap: 12,
  },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  title: { fontSize: 16, fontWeight: "600", color: "#F4F4F5" },
  body: { fontSize: 13, lineHeight: 20, color: "#AFB2BB" },
  status: { fontSize: 12, lineHeight: 18, color: "#AFB2BB" },
});
