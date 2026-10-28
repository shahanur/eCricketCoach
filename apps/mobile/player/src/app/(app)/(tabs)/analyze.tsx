import { UnavailableScreen } from "../../../features/navigation/unavailable-screen";

export default function AnalyzeScreen() {
  return (
    <UnavailableScreen
      title="Analyze"
      message="Video analysis is disabled until owner-scoped jobs and server-enforced usage are available."
    />
  );
}
