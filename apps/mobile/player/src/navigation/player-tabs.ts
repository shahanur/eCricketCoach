export const playerTabRoutes = [
  { name: "home", title: "Home" },
  { name: "practice", title: "Practice" },
  { name: "analyze", title: "Analyze" },
  { name: "progress", title: "Progress" },
  { name: "profile", title: "Profile" },
] as const;

export type PlayerTabName = (typeof playerTabRoutes)[number]["name"];
