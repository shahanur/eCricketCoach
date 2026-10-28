import { Link } from "expo-router";
import { View } from "react-native";

import { FeedbackScreen } from "../components/feedback/feedback-screen";
import { AppScreen } from "../components/layout/app-screen";
import { AppButton } from "../components/ui/app-button";

export default function NotFoundScreen() {
  return (
    <AppScreen>
      <FeedbackScreen
        variant="empty"
        title="Page not found"
        message="We couldn't find the page you were looking for."
      />
      <View>
        <Link href="/" asChild>
          <AppButton>Go to start</AppButton>
        </Link>
      </View>
    </AppScreen>
  );
}
