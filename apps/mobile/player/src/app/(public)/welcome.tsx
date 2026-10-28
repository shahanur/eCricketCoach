import { Link } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton } from "../../components/ui/app-button";
import { useAppTheme } from "../../theme/use-app-theme";

export default function WelcomeScreen() {
  const { colors } = useAppTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.hero}>
          <Image
            source={require("../../../assets/welcome-hero.png")}
            resizeMode="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel="eCricketCoach. Your personal cricket journey, one step at a time. A batter playing a shot in a floodlit stadium."
            style={styles.artwork}
          />
        </View>
        <View style={styles.actions}>
          <Link href="/(public)/register" asChild>
            <AppButton>Get Started →</AppButton>
          </Link>
          <View style={styles.loginRow}>
            <Text style={[styles.accountPrompt, { color: colors.text }]}>Already have an account?</Text>
            <Link
              href="/(public)/sign-in"
              style={[styles.loginLink, { color: colors.primary }]}
            >Log in</Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  hero: { flex: 1, minHeight: 420 },
  artwork: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  actions: { paddingHorizontal: 28, paddingBottom: 8, paddingTop: 8, gap: 4 },
  loginRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 6,
  },
  accountPrompt: { fontSize: 13, lineHeight: 20 },
  loginLink: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    paddingVertical: 14,
    paddingHorizontal: 6,
    minHeight: 48,
  },
});
