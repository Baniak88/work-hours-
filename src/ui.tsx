import React, { useEffect } from "react";
import {
  Text as NativeText,
  TextInput as NativeInput,
  Pressable as NativePressable,
  View as NativeView,
  ScrollView as NativeScroll,
  KeyboardAvoidingView as NativeKeyboard,
  ActivityIndicator as NativeActivity,
  Platform,
  StyleSheet,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useWorkHours } from "./WorkHoursProvider";
import { themeColor, themes, ThemeName } from "./themes";
import { useLocales } from "expo-localization";
import { languageFromLocale, setDeviceLanguage, translateText } from "./i18n";

export function usePresentation() {
  const { state } = useWorkHours();
  const locales = useLocales();
  const device = languageFromLocale(locales[0]?.languageCode);
  setDeviceLanguage(device);
  const language = state?.language ?? device,
    theme = state?.theme ?? "pastel";
  return {
    language,
    theme,
    locale: language === "en" ? "en-GB" : "pl-PL",
    t: (text: string) => translateText(text, language),
  };
}
function recolor(value: unknown, theme: ThemeName): unknown {
  if (typeof value === "string") return themeColor(value, theme);
  if (Array.isArray(value)) return value.map((v) => recolor(v, theme));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, recolor(v, theme)]),
    );
  return value;
}
function style<T>(value: T, theme: ThemeName): T {
  return recolor(StyleSheet.flatten(value as never), theme) as T;
}
export const Text = React.forwardRef<
  React.ComponentRef<typeof NativeText>,
  React.ComponentProps<typeof NativeText> & { verbatim?: boolean }
>(function Text(
  { children, style: appearance, accessibilityLabel, verbatim, ...props },
  ref,
) {
  const { theme, t } = usePresentation();
  return (
    <NativeText
      {...props}
      ref={ref}
      style={[
        {
          fontFamily: Platform.select({
            ios: "System",
            android: "sans-serif",
            default: "system-ui",
          }),
        },
        style(appearance, theme),
      ]}
      accessibilityLabel={
        accessibilityLabel ? t(accessibilityLabel) : undefined
      }
    >
      {verbatim
        ? children
        : React.Children.map(children, (child) =>
            typeof child === "string" ? t(child) : child,
          )}
    </NativeText>
  );
});
export const View = React.forwardRef<
  React.ComponentRef<typeof NativeView>,
  React.ComponentProps<typeof NativeView>
>(function View({ style: appearance, ...props }, ref) {
  const { theme } = usePresentation();
  return <NativeView {...props} ref={ref} style={style(appearance, theme)} />;
});
export const Pressable = React.forwardRef<
  React.ComponentRef<typeof NativePressable>,
  React.ComponentProps<typeof NativePressable>
>(function Pressable(
  { style: appearance, accessibilityLabel, accessibilityHint, ...props },
  ref,
) {
  const { theme, t } = usePresentation();
  return (
    <NativePressable
      {...props}
      ref={ref}
      accessibilityLabel={
        accessibilityLabel ? t(accessibilityLabel) : undefined
      }
      accessibilityHint={accessibilityHint ? t(accessibilityHint) : undefined}
      style={
        typeof appearance === "function"
          ? (state) => style(appearance(state), theme)
          : style(appearance, theme)
      }
    />
  );
});
export const TextInput = React.forwardRef<
  React.ComponentRef<typeof NativeInput>,
  React.ComponentProps<typeof NativeInput>
>(function TextInput(
  {
    style: appearance,
    accessibilityLabel,
    placeholder,
    placeholderTextColor,
    ...props
  },
  ref,
) {
  const { theme, t } = usePresentation();
  return (
    <NativeInput
      {...props}
      ref={ref}
      style={[
        {
          fontFamily: Platform.select({
            ios: "System",
            android: "sans-serif",
            default: "system-ui",
          }),
        },
        style(appearance, theme),
      ]}
      keyboardAppearance={
        theme === "light" || theme === "pastel" ? "light" : "dark"
      }
      accessibilityLabel={
        accessibilityLabel ? t(accessibilityLabel) : undefined
      }
      placeholder={placeholder ? t(placeholder) : undefined}
      placeholderTextColor={
        typeof placeholderTextColor === "string"
          ? themeColor(placeholderTextColor, theme)
          : placeholderTextColor
      }
    />
  );
});
export const ScrollView = React.forwardRef<
  React.ComponentRef<typeof NativeScroll>,
  React.ComponentProps<typeof NativeScroll>
>(function ScrollView(
  { style: appearance, contentContainerStyle, ...props },
  ref,
) {
  const { theme } = usePresentation();
  return (
    <NativeScroll
      {...props}
      ref={ref}
      style={style(appearance, theme)}
      contentContainerStyle={style(contentContainerStyle, theme)}
    />
  );
});
export const KeyboardAvoidingView = React.forwardRef<
  React.ComponentRef<typeof NativeKeyboard>,
  React.ComponentProps<typeof NativeKeyboard>
>(function KeyboardAvoidingView({ style: appearance, ...props }, ref) {
  const { theme } = usePresentation();
  return (
    <NativeKeyboard {...props} ref={ref} style={style(appearance, theme)} />
  );
});
export function ActivityIndicator({
  color,
  ...props
}: React.ComponentProps<typeof NativeActivity>) {
  const { theme } = usePresentation();
  return (
    <NativeActivity
      {...props}
      color={typeof color === "string" ? themeColor(color, theme) : color}
    />
  );
}
export function Icon({
  color,
  ...props
}: React.ComponentProps<typeof Ionicons>) {
  const { theme } = usePresentation();
  return (
    <Ionicons
      {...props}
      color={typeof color === "string" ? themeColor(color, theme) : color}
    />
  );
}
export function PresentationEffects() {
  const { theme, language } = usePresentation();
  useEffect(() => {
    if (Platform.OS !== "web") return;
    document.documentElement.lang = language;
    document.body.style.backgroundColor = themes[theme].bg;
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute("content", themes[theme].bg));
  }, [theme, language]);
  return null;
}
