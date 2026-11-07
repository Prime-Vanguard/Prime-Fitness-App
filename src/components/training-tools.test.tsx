import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TrainingTools } from "./training-tools";
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ locale: "en" }) }));
it("converts reviewed pounds into canonical kg", () => {
  const apply = vi.fn();
  render(<TrainingTools weight={20} units="imperial" onWarmup={vi.fn()} onWorkingWeight={apply} />);
  fireEvent.click(screen.getByRole("button", { name: "Plates & warm-up" }));
  const input = screen.getByLabelText("Working weight (lb)");
  expect(input).toHaveValue("44.09");
  fireEvent.change(input, { target: { value: "99.2" } });
  fireEvent.click(screen.getByRole("button", { name: "Use as actual working weight" }));
  expect(apply).toHaveBeenCalledWith(45);
});
it("keeps blank/decimal working weight editable and applies an explicit actual weight", () => {
  const apply = vi.fn();
  render(<TrainingTools weight={0} onWarmup={vi.fn()} onWorkingWeight={apply} />);
  fireEvent.click(screen.getByRole("button", { name: "Plates & warm-up" }));
  const input = screen.getByLabelText("Working weight (kg)");
  expect(input).toHaveValue("0");
  fireEvent.change(input, { target: { value: "" } });
  expect(input).toHaveValue("");
  expect(screen.getByRole("button", { name: "Use as actual working weight" })).toBeDisabled();
  fireEvent.change(input, { target: { value: "22.5" } });
  fireEvent.click(screen.getByRole("button", { name: "Use as actual working weight" }));
  expect(apply).toHaveBeenCalledWith(22.5);
});
