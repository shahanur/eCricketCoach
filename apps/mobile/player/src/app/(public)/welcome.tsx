import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { BrandMark } from "../../components/brand/brand-mark";
import { AppScreen } from "../../components/layout/app-screen";
import { AppButton } from "../../components/ui/app-button";
import { useAppTheme } from "../../theme/use-app-theme";

const HIGHLIGHTS = [
  {
    title: "Personal roadmap",
    text: "Batting, bowling, wicketkeeping and fielding goals built around your game.",
  },
  {
    title: "AI video feedback",
    text: "Biomechanics and balance insights from your own training clips.",
  },
  {
    title: "Solo practice",
    text: "Guided drills you can work through at the nets or at home.",
  },
] as const;

export default function WelcomeScreen() {
  const { colors } = useAppTheme();

  return (
    <AppScreen>
      <View style={styles.content}>
        <BrandMark size="large" />

        <View style={styles.hero}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            Train smarter.{"\n"}Play better.
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>
            Your personal cricket coach, wherever you practise.
          </Text>
        </View>

        <View style={styles.highlights}>
          {HIGHLIGHTS.map(({ title, text }) => (
            <View
              key={title}
              style={[
                styles.highlight,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.highlightAccent, { backgroundColor: colors.primary }]} />
              <View style={styles.highlightBody}>
                <Text style={[styles.highlightTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.highlightText, { color: colors.mutedText }]}>{text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Link href="/(public)/register" asChild>
            <AppButton>Register as player</AppButton>
          </Link>
          <Link href="/(public)/sign-in" asChild>
            <AppButton variant="secondary">I already have an account</AppButton>
          </Link>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "space-between",
    gap: 32,
    paddingVertical: 16,
  },
  hero: {
    gap: 12,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 44,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 26,
  },
  highlights: {
    gap: 12,
  },
  highlight: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    overflow: "hidden",
  },
  highlightAccent: {
    width: 4,
  },
  highlightBody: {
    flex: 1,
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  highlightTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  highlightText: {
    fontSize: 15,
    lineHeight: 21,
  },
  actions: {
    gap: 12,
  },
});
