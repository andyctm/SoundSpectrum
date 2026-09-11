export type AudioSourceKind = "microphone" | "file";

export type AnalyzerStatus =
  | "idle"
  | "requesting-permission"
  | "listening"
  | "playing"
  | "paused"
  | "stopped"
  | "error";

/** One tick of analysis data delivered on every animation frame while the engine is active. */
export interface AnalyzerFrame {
  /** Byte time-domain samples (0-255, centered on 128) straight from the AnalyserNode. */
  timeDomain: Uint8Array;
  /** Byte frequency-domain magnitudes (0-255) straight from the AnalyserNode. */
  frequency: Uint8Array;
  sampleRate: number;
  fftSize: number;
  /** frequency.length, i.e. fftSize / 2. */
  binCount: number;
}

export interface DominantFrequency {
  frequency: number;
  magnitude: number;
  binIndex: number;
}

export interface PeakFrequency extends DominantFrequency {
  /** audioContext.currentTime at which this peak was recorded. */
  capturedAt: number;
}

export interface MusicalNote {
  name: string;
  octave: number;
  /** Deviation from the exact note pitch, in cents (-50..50). */
  cents: number;
}

export interface AnalyzerSnapshot {
  status: AnalyzerStatus;
  source: AudioSourceKind | null;
  error: string | null;
  fileName: string | null;
  duration: number;
  currentTime: number;
  sampleRate: number;
  fftSize: number;
}
