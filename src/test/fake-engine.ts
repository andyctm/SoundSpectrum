import { vi } from "vitest";
import type { AudioAnalyzerEngine } from "@/lib/audio/audio-engine";
import type {
  AnalyzerSnapshot,
  DominantFrequency,
  PeakFrequency,
} from "@/lib/audio/types";

type StatusListener = (snapshot: AnalyzerSnapshot) => void;
type DominantListener = (
  dominant: DominantFrequency | null,
  peak: PeakFrequency | null,
  rms: number,
) => void;
type FrameListener = Parameters<AudioAnalyzerEngine["subscribeFrames"]>[0];

/**
 * Minimal in-memory stand-in for AudioAnalyzerEngine used to unit-test
 * dashboard components without touching the real Web Audio API (which
 * jsdom does not implement).
 */
export function createFakeEngine(initial?: Partial<AnalyzerSnapshot>) {
  let snapshot: AnalyzerSnapshot = {
    status: "idle",
    source: null,
    error: null,
    fileName: null,
    duration: 0,
    currentTime: 0,
    sampleRate: 48_000,
    fftSize: 2048,
    ...initial,
  };

  const statusListeners = new Set<StatusListener>();
  const dominantListeners = new Set<DominantListener>();
  const frameListeners = new Set<FrameListener>();

  function setSnapshot(patch: Partial<AnalyzerSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    statusListeners.forEach((listener) => listener(snapshot));
  }

  function emitDominant(
    dominant: DominantFrequency | null,
    peak: PeakFrequency | null,
    rms: number,
  ) {
    dominantListeners.forEach((listener) => listener(dominant, peak, rms));
  }

  const engine = {
    getSnapshot: () => snapshot,
    subscribeStatus: (listener: StatusListener) => {
      statusListeners.add(listener);
      listener(snapshot);
      return () => statusListeners.delete(listener);
    },
    subscribeDominant: (listener: DominantListener) => {
      dominantListeners.add(listener);
      return () => dominantListeners.delete(listener);
    },
    subscribeFrames: (listener: FrameListener) => {
      frameListeners.add(listener);
      return () => frameListeners.delete(listener);
    },
    startMicrophone: vi.fn(async () => {
      setSnapshot({ status: "listening", source: "microphone", error: null });
    }),
    loadFile: vi.fn(async (file: File) => {
      setSnapshot({
        status: "stopped",
        source: "file",
        fileName: file.name,
        error: null,
      });
    }),
    play: vi.fn(() => setSnapshot({ status: "playing" })),
    pause: vi.fn(() => setSnapshot({ status: "paused" })),
    stop: vi.fn(() => setSnapshot({ status: "idle", source: null })),
    setFftSize: vi.fn((size: number) => setSnapshot({ fftSize: size })),
    resetPeak: vi.fn(() => emitDominant(null, null, 0)),
    dispose: vi.fn(),
  };

  return {
    engine: engine as unknown as AudioAnalyzerEngine,
    setSnapshot,
    emitDominant,
  };
}
