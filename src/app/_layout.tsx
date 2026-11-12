import React from "react";
import { Slot } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";
import { WorkHoursProvider } from "../WorkHoursProvider";
export default function RootLayout() {
  const [loaded, error] = useFonts(Ionicons.font);
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#101314",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color="#B4F272" />
      </View>
    );
  return (
    <SafeAreaProvider>
      <WorkHoursProvider>
        <Slot />
      </WorkHoursProvider>
    </SafeAreaProvider>
  );
}
