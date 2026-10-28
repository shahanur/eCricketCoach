import { render } from "@testing-library/react-native";
import * as ReactNative from "react-native";

import WelcomeScreen from "../app/(public)/welcome";
import { colorSchemes } from "../theme/colors";

jest.mock("expo-router", () => ({
  Link: ({ href, children, asChild, style }: {
    href: string; children: React.ReactNode; asChild?: boolean; style?: ReactNative.TextStyle;
  }) => {
    const { Text, View } = jest.requireActual<typeof import("react-native")>("react-native");
    return asChild
      ? <View accessibilityLabel={href}>{children}</View>
      : <Text accessible accessibilityRole="link" accessibilityHint={href} style={style}>{children}</Text>;
  },
}));

describe("welcome hero", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the supplied full artwork once, without duplicate branding or feature cards", async () => {
    const screen = await render(<WelcomeScreen />);
    const artwork = screen.getByRole("image");
    expect(artwork.props.source).toEqual(require("../../assets/welcome-hero.png"));
    expect(artwork.props.resizeMode).toBe("contain");
    expect(artwork.props.accessibilityLabel).toContain("Your personal cricket journey");
    expect(screen.getAllByRole("image")).toHaveLength(1);
    expect(screen.queryByText("Your game.")).toBeNull();
    expect(screen.queryByText("Personal roadmap")).toBeNull();
    expect(screen.getByRole("button", { name: "Get Started →" })).toBeTruthy();
    expect(screen.getByLabelText("/(public)/register")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Log in" }).props.accessibilityHint).toBe("/(public)/sign-in");
    expect(screen.getByText("Already have an account?")).toBeTruthy();
  });

  it("follows device appearance for the surrounding text and controls", async () => {
    const scheme = jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    const screen = await render(<WelcomeScreen />);
    expect(screen.getByText("Already have an account?")).toHaveStyle({ color: colorSchemes.light.text });
    expect(screen.getByText("Log in")).toHaveStyle({ color: colorSchemes.light.primary });
    scheme.mockReturnValue("dark");
    await screen.rerender(<WelcomeScreen />);
    expect(screen.getByText("Already have an account?")).toHaveStyle({ color: colorSchemes.dark.text });
    expect(screen.getByText("Log in")).toHaveStyle({ color: colorSchemes.dark.primary });
  });
});
