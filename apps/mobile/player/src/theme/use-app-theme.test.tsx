import { render, renderHook } from "@testing-library/react-native";
import * as ReactNative from "react-native";

import { AppButton } from "../components/ui/app-button";
import { PlayerCard } from "../components/ui/player-card";
import { colorSchemes } from "./colors";
import { useAppTheme } from "./use-app-theme";

function luminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)!.map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("system appearance", () => {
  afterEach(() => jest.restoreAllMocks());

  it("follows device theme changes at runtime and defaults to light", async () => {
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    const hook = await renderHook(() => useAppTheme());
    expect(hook.result.current.colors).toBe(colorSchemes.light);
    scheme.mockReturnValue("dark");
    await hook.rerender({});
    expect(hook.result.current).toEqual({ mode: "dark", colors: colorSchemes.dark });
    scheme.mockReturnValue(null);
    await hook.rerender({});
    expect(hook.result.current.mode).toBe("light");
  });

  it("recolors shared cards and buttons when the device changes theme", async () => {
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    const content = <PlayerCard title="Your goals"><AppButton>Continue</AppButton></PlayerCard>;
    const screen = await render(content);
    expect(screen.getByText("Your goals")).toHaveStyle({ color: colorSchemes.light.text });
    expect(screen.getByRole("button", { name: "Continue" })).toHaveStyle({ backgroundColor: colorSchemes.light.accent });
    scheme.mockReturnValue("dark");
    await screen.rerender(<PlayerCard title="Your goals"><AppButton>Continue</AppButton></PlayerCard>);
    expect(screen.getByText("Your goals")).toHaveStyle({ color: colorSchemes.dark.text });
    expect(screen.getByText("Continue")).toHaveStyle({ color: colorSchemes.dark.onAccent });
  });

  it.each(["light", "dark"] as const)("%s colors meet normal-text contrast on their intended backgrounds", (mode) => {
    const colors = colorSchemes[mode];
    for (const [foreground, background] of [
      [colors.text, colors.background], [colors.text, colors.surface],
      [colors.mutedText, colors.background], [colors.mutedText, colors.surface],
      [colors.primary, colors.secondary], [colors.onAccent, colors.accent],
      [colors.error, colors.surface],
    ]) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(["light", "dark"] as const)("keeps %s roadmap surfaces and controls on the blue/slate palette", async mode => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(mode);
    const hook = await renderHook(() => useAppTheme("plan"));
    const colors = hook.result.current.colors;
    const palette = colorSchemes[mode];
    expect(colors.surface).toBe(palette.planSurface);
    expect(colors.background).toBe(palette.planBackground);
    expect(colors.accent).toBe(palette.planAccent);
    expect(colors.accent).toBe(palette.accent);
    expect(colors.background).toBe(palette.background);
    expect(colors.surface).toBe(palette.surface);
    expect(colors.border).toBe(palette.border);
    const screen = await render(<PlayerCard tone="plan" title="Your plan"><AppButton tone="plan">View drills</AppButton></PlayerCard>);
    expect(screen.getByRole("button", { name: "View drills" })).toHaveStyle({ backgroundColor: palette.planAccent });
    expect(screen.getByText("View drills")).toHaveStyle({ color: palette.onPlanAccent });
    for (const [foreground, background] of [
      [colors.text, colors.surface], [colors.mutedText, colors.surface],
      [colors.primary, colors.surface], [colors.onAccent, colors.accent],
      [colors.purple, colors.surface], [colors.gold, colors.surface],
    ]) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
    expect((await renderHook(() => useAppTheme())).result.current.colors).toBe(palette);
  });
});
