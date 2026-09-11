import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AudioEngineContext } from "@/components/providers/audio-engine-provider";
import { StatsPanel } from "@/components/dashboard/stats-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createFakeEngine } from "@/test/fake-engine";

function renderPanel(engine: ReturnType<typeof createFakeEngine>["engine"]) {
  return render(
    <AudioEngineContext.Provider value={engine}>
      <TooltipProvider>
        <StatsPanel />
      </TooltipProvider>
    </AudioEngineContext.Provider>,
  );
}

describe("StatsPanel", () => {
  it("shows placeholders before any audio has been analyzed", () => {
    const { engine } = createFakeEngine();
    renderPanel(engine);

    expect(screen.getByText("Dominant Frequency")).toBeInTheDocument();
    expect(screen.getAllByText("\u2014")).toHaveLength(2);
  });

  it("renders the dominant and peak frequency once a frame arrives", () => {
    const { engine, emitDominant } = createFakeEngine();
    renderPanel(engine);

    act(() => {
      emitDominant(
        { frequency: 440, magnitude: 200, binIndex: 20 },
        { frequency: 880, magnitude: 255, binIndex: 40, capturedAt: 1 },
        0.5,
      );
    });

    expect(screen.getByText("440.0 Hz")).toBeInTheDocument();
    expect(screen.getByText("880.0 Hz")).toBeInTheDocument();
    expect(screen.getByText("A4 (+0\u00A2)")).toBeInTheDocument();
  });

  it("resets the peak reading when the reset button is clicked", async () => {
    const user = userEvent.setup();
    const { engine, emitDominant } = createFakeEngine();
    renderPanel(engine);

    act(() => {
      emitDominant(
        { frequency: 440, magnitude: 200, binIndex: 20 },
        { frequency: 880, magnitude: 255, binIndex: 40, capturedAt: 1 },
        0.5,
      );
    });

    await user.click(screen.getByRole("button", { name: /reset peak hold/i }));
    expect(engine.resetPeak).toHaveBeenCalledTimes(1);
  });
});
