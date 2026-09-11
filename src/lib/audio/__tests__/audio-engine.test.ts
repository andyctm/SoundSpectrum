import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioAnalyzerEngine } from "@/lib/audio/audio-engine";

class FakeAnalyserNode {
  fftSize = 2048;
  smoothingTimeConstant = 0;
  connect = vi.fn();
  disconnect = vi.fn();
  get frequencyBinCount() {
    return this.fftSize / 2;
  }
  getByteTimeDomainData(array: Uint8Array) {
    array.fill(128);
  }
  getByteFrequencyData(array: Uint8Array) {
    array.fill(0);
    array[10] = 200; // a synthetic "dominant" bin
  }
}

class FakeAudioBufferSourceNode {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
}

class FakeAudioContext {
  sampleRate = 48_000;
  currentTime = 0;
  destination = {};
  createAnalyser() {
    return new FakeAnalyserNode() as unknown as AnalyserNode;
  }
  createMediaStreamSource() {
    return { connect: vi.fn(), disconnect: vi.fn() } as unknown as MediaStreamAudioSourceNode;
  }
  createBufferSource() {
    return new FakeAudioBufferSourceNode() as unknown as AudioBufferSourceNode;
  }
  decodeAudioData() {
    return Promise.resolve({ duration: 3 } as AudioBuffer);
  }
  close() {
    return Promise.resolve();
  }
}

function makeFakeStream(): MediaStream {
  const track = { stop: vi.fn() };
  return { getTracks: () => [track] } as unknown as MediaStream;
}

let rafCallback: FrameRequestCallback | null = null;

function flushFrame() {
  const cb = rafCallback;
  rafCallback = null;
  cb?.(0);
}

describe("AudioAnalyzerEngine", () => {
  beforeEach(() => {
    rafCallback = null;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      rafCallback = null;
    });
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(makeFakeStream()) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeEngine() {
    return new AudioAnalyzerEngine({
      createAudioContext: () => new FakeAudioContext() as unknown as AudioContext,
    });
  }

  it("starts idle and reports the initial snapshot to new status subscribers", () => {
    const engine = makeEngine();
    const listener = vi.fn();
    engine.subscribeStatus(listener);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ status: "idle", source: null }),
    );
  });

  it("transitions to listening after starting the microphone", async () => {
    const engine = makeEngine();
    await engine.startMicrophone();
    expect(engine.getSnapshot()).toMatchObject({
      status: "listening",
      source: "microphone",
    });
  });

  it("surfaces a getUserMedia rejection as an error status", async () => {
    const engine = makeEngine();
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new Error("Permission denied")),
      },
    });
    await expect(engine.startMicrophone()).rejects.toThrow("Permission denied");
    expect(engine.getSnapshot()).toMatchObject({ status: "error" });
  });

  it("emits analysis frames and dominant frequency updates while listening", async () => {
    const engine = makeEngine();
    const frameListener = vi.fn();
    const dominantListener = vi.fn();
    engine.subscribeFrames(frameListener);
    engine.subscribeDominant(dominantListener);

    await engine.startMicrophone();
    flushFrame();

    expect(frameListener).toHaveBeenCalledTimes(1);
    expect(dominantListener).toHaveBeenCalledTimes(1);
    const [dominant, peak] = dominantListener.mock.calls[0];
    expect(dominant).not.toBeNull();
    expect(peak).toEqual(expect.objectContaining({ binIndex: dominant.binIndex }));
  });

  it("loads a file and transitions through stopped -> playing -> stopped", async () => {
    const engine = makeEngine();
    const file = { arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) } as unknown as File;

    await engine.loadFile(file);
    expect(engine.getSnapshot()).toMatchObject({ status: "stopped", source: "file" });

    engine.play();
    expect(engine.getSnapshot().status).toBe("playing");

    engine.stop();
    expect(engine.getSnapshot().status).toBe("stopped");
  });

  it("keeps the highest-magnitude reading as the peak until resetPeak is called", async () => {
    const engine = makeEngine();
    const dominantListener = vi.fn();
    engine.subscribeDominant(dominantListener);

    await engine.startMicrophone();
    flushFrame();

    const [, firstPeak] = dominantListener.mock.calls[0];
    expect(firstPeak).not.toBeNull();

    engine.resetPeak();
    const lastCall = dominantListener.mock.calls.at(-1)!;
    expect(lastCall).toEqual([null, null, 0]);
  });

  it("stops the animation loop and clears listeners on dispose", async () => {
    const engine = makeEngine();
    await engine.startMicrophone();
    expect(rafCallback).not.toBeNull();

    engine.dispose();
    expect(rafCallback).toBeNull();
  });
});
