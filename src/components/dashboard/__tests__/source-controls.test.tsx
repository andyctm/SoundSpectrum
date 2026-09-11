import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AudioEngineContext } from "@/components/providers/audio-engine-provider";
import { SourceControls } from "@/components/dashboard/source-controls";
import { createFakeEngine } from "@/test/fake-engine";

function renderWithEngine(engine: ReturnType<typeof createFakeEngine>["engine"]) {
  return render(
    <AudioEngineContext.Provider value={engine}>
      <SourceControls />
    </AudioEngineContext.Provider>,
  );
}

describe("SourceControls", () => {
  it("starts the microphone when clicked and flips to a stop control", async () => {
    const user = userEvent.setup();
    const { engine } = createFakeEngine();
    renderWithEngine(engine);

    await user.click(screen.getByRole("button", { name: /start microphone/i }));

    expect(engine.startMicrophone).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("button", { name: /stop listening/i }),
    ).toBeInTheDocument();
  });

  it("stops the microphone from the listening state", async () => {
    const user = userEvent.setup();
    const { engine } = createFakeEngine({ status: "listening", source: "microphone" });
    renderWithEngine(engine);

    await user.click(await screen.findByRole("button", { name: /stop listening/i }));
    expect(engine.stop).toHaveBeenCalledTimes(1);
  });

  it("loads an uploaded file and shows playback controls", async () => {
    const user = userEvent.setup();
    const { engine } = createFakeEngine();
    renderWithEngine(engine);

    const file = new File(["dummy"], "tone.wav", { type: "audio/wav" });
    const input = screen.getByLabelText(/upload audio file/i);
    await user.upload(input, file);

    expect(engine.loadFile).toHaveBeenCalledWith(file);
    expect(await screen.findByText("tone.wav")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
  });

  it("renders an alert when the engine reports an error", () => {
    const { engine } = createFakeEngine({
      status: "error",
      error: "Microphone access was denied.",
    });
    renderWithEngine(engine);

    expect(screen.getByText("Microphone access was denied.")).toBeInTheDocument();
  });

  it("changes the FFT size via the slider control", async () => {
    const user = userEvent.setup();
    const { engine } = createFakeEngine();
    renderWithEngine(engine);

    const slider = screen.getByLabelText(/fft size/i);
    slider.focus();
    await user.keyboard("[ArrowRight][ArrowRight]");

    expect(engine.setFftSize).toHaveBeenCalledWith(4096);
  });
});
