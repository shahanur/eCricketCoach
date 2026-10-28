import { playerTabRoutes } from "./player-tabs";

describe("player navigation tabs", () => {
  it("defines the five planned destinations without adding club tools", () => {
    expect(playerTabRoutes.map(({ name }) => name)).toEqual([
      "home",
      "practice",
      "analyze",
      "progress",
      "profile",
    ]);
  });
});
