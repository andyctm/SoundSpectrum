import { calculateRms, findDominantFrequency } from "./fft-utils";
import type {
  AnalyzerFrame,
  AnalyzerSnapshot,
  AnalyzerStatus,
  AudioSourceKind,
  DominantFrequency,
  PeakFrequency,
} from "./types";

export const FFT_SIZE_OPTIONS = [512, 1024, 2048, 4096, 8192] as const;
export type FftSizeOption = (typeof FFT_SIZE_OPTIONS)[number];

const DEFAULT_FFT_SIZE: FftSizeOption = 2048;
const DEFAULT_SMOOTHING = 0.75;

type FrameListener = (frame: AnalyzerFrame) => void;
type StatusListener = (snapshot: AnalyzerSnapshot) => void;
type DominantListener = (
  dominant: DominantFrequency | null,
  peak: PeakFrequency | null,
  rms: number,
) => void;

/**
 * Owns a single Web Audio graph (microphone or decoded file -> AnalyserNode)
 * and drives one shared requestAnimationFrame loop that fans out analysis
 * frames to subscribers. Kept framework-agnostic and independently testable:
 * callers inject the AudioContext constructor so unit tests can supply a fake.
 */
export class AudioAnalyzerEngine {
  private readonly createAudioContext: () => AudioContext;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private fileSourceNode: AudioBufferSourceNode | null = null;
  private decodedBuffer: AudioBuffer | null = null;

  private rafHandle: number | null = null;
  private timeDomainBuffer: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private frequencyBuffer: Uint8Array<ArrayBuffer> = new Uint8Array(0);

  private frameListeners = new Set<FrameListener>();
  private statusListeners = new Set<StatusListener>();
  private dominantListeners = new Set<DominantListener>();

  private status: AnalyzerStatus = "idle";
  private source: AudioSourceKind | null = null;
  private error: string | null = null;
  private fileName: string | null = null;
  private playbackStartedAtContextTime = 0;
  private playbackOffset = 0;
  private fftSize: FftSizeOption = DEFAULT_FFT_SIZE;

  private peak: PeakFrequency | null = null;

  constructor(
    options: { createAudioContext?: () => AudioContext } = {},
  ) {
    this.createAudioContext =
      options.createAudioContext ??
      (() => new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)());
  }

  // ---------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------

  subscribeFrames(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getSnapshot());
    return () => this.statusListeners.delete(listener);
  }

  subscribeDominant(listener: DominantListener): () => void {
    this.dominantListeners.add(listener);
    return () => this.dominantListeners.delete(listener);
  }

  getSnapshot(): AnalyzerSnapshot {
    return {
      status: this.status,
      source: this.source,
      error: this.error,
      fileName: this.fileName,
      duration: this.decodedBuffer?.duration ?? 0,
      currentTime: this.getCurrentTime(),
      sampleRate: this.audioContext?.sampleRate ?? 0,
      fftSize: this.fftSize,
    };
  }

  // ---------------------------------------------------------------------
  // Setup helpers
  // ---------------------------------------------------------------------

  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = this.createAudioContext();
    }
    return this.audioContext;
  }

  private ensureAnalyser(): AnalyserNode {
    const ctx = this.ensureContext();
    if (!this.analyser) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.analyser.smoothingTimeConstant = DEFAULT_SMOOTHING;
      this.timeDomainBuffer = new Uint8Array(this.analyser.fftSize);
      this.frequencyBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    }
    return this.analyser;
  }

  setFftSize(size: FftSizeOption): void {
    this.fftSize = size;
    if (this.analyser) {
      this.analyser.fftSize = size;
      this.timeDomainBuffer = new Uint8Array(this.analyser.fftSize);
      this.frequencyBuffer = new Uint8Array(this.analyser.frequencyBinCount);
    }
    this.emitStatus();
  }

  // ---------------------------------------------------------------------
  // Microphone
  // ---------------------------------------------------------------------

  async startMicrophone(): Promise<void> {
    this.teardownGraph({ keepContext: true });
    this.setStatus("requesting-permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const ctx = this.ensureContext();
      const analyser = this.ensureAnalyser();
      this.mediaStream = stream;
      this.micSourceNode = ctx.createMediaStreamSource(stream);
      this.micSourceNode.connect(analyser);
      this.source = "microphone";
      this.fileName = null;
      this.error = null;
      this.setStatus("listening");
      this.startLoop();
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : "Microphone access was denied.";
      this.setStatus("error");
      throw err;
    }
  }

  // ---------------------------------------------------------------------
  // File upload
  // ---------------------------------------------------------------------

  async loadFile(file: File): Promise<void> {
    this.teardownGraph({ keepContext: true });
    const ctx = this.ensureContext();
    try {
      const arrayBuffer = await file.arrayBuffer();
      this.decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.fileName = file.name;
      this.source = "file";
      this.error = null;
      this.playbackOffset = 0;
      this.setStatus("stopped");
    } catch (err) {
      this.error =
        err instanceof Error ? err.message : "Could not decode audio file.";
      this.setStatus("error");
      throw err;
    }
  }

  play(): void {
    if (!this.decodedBuffer) return;
    const ctx = this.ensureContext();
    const analyser = this.ensureAnalyser();

    this.fileSourceNode?.disconnect();
    const node = ctx.createBufferSource();
    node.buffer = this.decodedBuffer;
    node.connect(analyser);
    analyser.connect(ctx.destination);
    node.onended = () => {
      if (this.status === "playing") {
        this.playbackOffset = 0;
        this.setStatus("stopped");
        this.stopLoop();
      }
    };
    node.start(0, this.playbackOffset % this.decodedBuffer.duration);
    this.fileSourceNode = node;
    this.playbackStartedAtContextTime = ctx.currentTime;
    this.setStatus("playing");
    this.startLoop();
  }

  pause(): void {
    if (this.status !== "playing") return;
    this.playbackOffset = this.getCurrentTime();
    this.fileSourceNode?.disconnect();
    this.fileSourceNode = null;
    this.setStatus("paused");
    this.stopLoop();
  }

  stop(): void {
    this.playbackOffset = 0;
    this.teardownGraph({ keepContext: true });
    this.setStatus(this.source ? "stopped" : "idle");
  }

  getCurrentTime(): number {
    if (this.status === "playing" && this.audioContext) {
      return (
        this.playbackOffset +
        (this.audioContext.currentTime - this.playbackStartedAtContextTime)
      );
    }
    return this.playbackOffset;
  }

  // ---------------------------------------------------------------------
  // Shared teardown / disposal
  // ---------------------------------------------------------------------

  private teardownGraph(opts: { keepContext: boolean }): void {
    this.stopLoop();
    this.micSourceNode?.disconnect();
    this.micSourceNode = null;
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
    this.fileSourceNode?.disconnect();
    this.fileSourceNode = null;
    if (!opts.keepContext) {
      this.analyser?.disconnect();
      this.analyser = null;
    }
  }

  dispose(): void {
    this.teardownGraph({ keepContext: false });
    void this.audioContext?.close();
    this.audioContext = null;
    this.frameListeners.clear();
    this.statusListeners.clear();
    this.dominantListeners.clear();
  }

  resetPeak(): void {
    this.peak = null;
    this.dominantListeners.forEach((listener) => listener(null, null, 0));
  }

  // ---------------------------------------------------------------------
  // Analysis loop
  // ---------------------------------------------------------------------

  private startLoop(): void {
    if (this.rafHandle !== null) return;
    const tick = () => {
      this.emitFrame();
      this.rafHandle = requestAnimationFrame(tick);
    };
    this.rafHandle = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private emitFrame(): void {
    const analyser = this.analyser;
    const ctx = this.audioContext;
    if (!analyser || !ctx) return;

    analyser.getByteTimeDomainData(this.timeDomainBuffer);
    analyser.getByteFrequencyData(this.frequencyBuffer);

    const frame: AnalyzerFrame = {
      timeDomain: this.timeDomainBuffer,
      frequency: this.frequencyBuffer,
      sampleRate: ctx.sampleRate,
      fftSize: analyser.fftSize,
      binCount: this.frequencyBuffer.length,
    };
    this.frameListeners.forEach((listener) => listener(frame));

    const dominant = findDominantFrequency(
      this.frequencyBuffer,
      ctx.sampleRate,
      analyser.fftSize,
    );
    if (
      dominant &&
      (!this.peak || dominant.magnitude >= this.peak.magnitude)
    ) {
      this.peak = { ...dominant, capturedAt: ctx.currentTime };
    }
    const rms = calculateRms(this.timeDomainBuffer);
    this.dominantListeners.forEach((listener) =>
      listener(dominant, this.peak, rms),
    );
  }

  private setStatus(status: AnalyzerStatus): void {
    this.status = status;
    this.emitStatus();
  }

  private emitStatus(): void {
    const snapshot = this.getSnapshot();
    this.statusListeners.forEach((listener) => listener(snapshot));
  }
}
