import { UnavailableScreen } from "../../../features/navigation/unavailable-screen";

export default function HomeScreen() {
  return (
    <UnavailableScreen
      title="Home"
      message="A player dashboard will appear when a verified self-profile and dashboard API are available."
    />
  );
}
