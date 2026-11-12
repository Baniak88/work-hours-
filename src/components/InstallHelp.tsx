import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

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
          color="#B4F272"
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
        style={[s.status, ready && { color: "#B4F272" }]}
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#334144",
    backgroundColor: "#1B2325",
    gap: 12,
  },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  title: { fontSize: 16, fontWeight: "600", color: "#F4F8F5" },
  body: { fontSize: 13, lineHeight: 20, color: "#A6B4B6" },
  status: { fontSize: 12, lineHeight: 18, color: "#A6B4B6" },
});
