import { fireEvent, render } from "@testing-library/react-native";

import { FeedbackScreen } from "./feedback-screen";

describe("FeedbackScreen", () => {
  it("announces an error and offers a working retry action", async () => {
    const onRetry = jest.fn();
    const { getByRole, getByText } = await render(
      <FeedbackScreen
        variant="error"
        title="Could not load"
        message="Check your connection."
        onRetry={onRetry}
      />,
    );

    expect(getByText("Could not load")).toBeTruthy();
    await fireEvent.press(getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders offline guidance without requiring fabricated data", async () => {
    const { getByText, queryByRole } = await render(
      <FeedbackScreen
        variant="offline"
        title="You're offline"
        message="Connect to the internet to try again."
      />,
    );

    expect(getByText("You're offline")).toBeTruthy();
    expect(
      queryByRole("button", { name: "Try again" }),
    ).toBeNull();
  });
});
