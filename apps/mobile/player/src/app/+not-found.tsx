import { UnavailableScreen } from "../features/navigation/unavailable-screen";

export default function NotFoundScreen() {
  return (
    <UnavailableScreen
      title="This page"
      message="The requested destination does not exist in this app."
    />
  );
}
