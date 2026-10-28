import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import type { ComponentProps } from "react";

import SignInScreen from "../../app/(public)/sign-in";
import { useSignIn } from "./use-sign-in";

jest.mock("./use-sign-in", () => ({ useSignIn: jest.fn() }));
jest.mock("../web-app/open-web-app-button", () => ({
  OpenWebAppButton: ({ label }: { label: string }) => {
    const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
    return <Text>{label}</Text>;
  },
}));
jest.mock("expo-router", () => ({
  router: { navigate: jest.fn() },
  Link: ({ href, children, style }: { href: string; children: React.ReactNode; style: ComponentProps<typeof import("react-native").Text>["style"] }) => {
    const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
    return <Text accessible accessibilityRole="link" accessibilityHint={href} style={style}>{children}</Text>;
  },
}));

describe("social-only sign-in screen", () => {
  const signInWithGoogle = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useSignIn).mockReturnValue({
      signingIn: false, feedback: null, signInWithGoogle,
    });
  });

  it("matches the reference copy and shows social buttons without a password form", async () => {
    const screen = await render(<SignInScreen />);
    expect(screen.getByText("Welcome back 👋")).toBeTruthy();
    expect(screen.getByText("Log in to continue your cricket journey.")).toBeTruthy();
    expect(screen.queryByText("OR CONTINUE WITH")).toBeNull();
    expect(screen.queryByText(/Google sign-in isn't available/)).toBeNull();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryByText(/Forgot password|Email address|Password/)).toBeNull();
    expect(screen.getByRole("button", { name: "Continue with Apple", disabled: true })).toBeTruthy();
    expect(screen.getByText("Apple sign-in is not available in this release.")).toBeTruthy();
    expect(screen.queryByText("Continue on the website")).toBeNull();
    expect(screen.getByRole("link", { name: "Create account" }).props.accessibilityHint).toBe("/(public)/register");
    expect(screen.getByRole("link", { name: "Sign up" }).props.accessibilityHint).toBe("/(public)/register");
    await fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: "Go back" }));
    expect(router.navigate).toHaveBeenCalledWith("/(public)/welcome");
  });

  it("disables Google during sign-in and preserves actionable failure feedback", async () => {
    jest.mocked(useSignIn).mockReturnValue({
      signingIn: true,
      feedback: { kind: "registration-required", message: "Your account may still be awaiting approval." },
      signInWithGoogle,
    });
    const screen = await render(<SignInScreen />);
    expect(screen.getByRole("button", { name: "Continue with Google", disabled: true })).toBeTruthy();
    expect(screen.getByText("Your account may still be awaiting approval.")).toBeTruthy();
    expect(screen.getByText("Register on the website")).toBeTruthy();
  });

  it("keeps Google active immediately without a provider discovery gate", async () => {
    const screen = await render(<SignInScreen />);
    expect(screen.queryByText(/Google sign-in isn't available on this device/)).toBeNull();
    expect(screen.queryByText("Continue on the website")).toBeNull();
    expect(screen.getByRole("button", { name: "Continue with Google", disabled: false })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it("keeps actual sign-in failures explicit and lets Google be retried", async () => {
    jest.mocked(useSignIn).mockReturnValue({
      signingIn: false, feedback: { kind: "error", message: "Check your connection and try again." }, signInWithGoogle,
    });
    const screen = await render(<SignInScreen />);
    expect(screen.getByRole("button", { name: "Continue with Google", disabled: false })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Apple", disabled: true })).toBeTruthy();
    expect(screen.getByText("Check your connection and try again.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });
});
