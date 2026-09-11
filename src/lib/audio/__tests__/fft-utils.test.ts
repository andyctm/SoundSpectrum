import { describe, expect, it } from "vitest";
import {
  binForFrequency,
  calculateRms,
  findDominantFrequency,
  frequencyForBin,
  noteFromFrequency,
} from "@/lib/audio/fft-utils";

const SAMPLE_RATE = 48_000;
const FFT_SIZE = 2048;

describe("frequencyForBin / binForFrequency", () => {
  it("round-trips a bin index to a frequency and back", () => {
    const bin = 100;
    const freq = frequencyForBin(bin, SAMPLE_RATE, FFT_SIZE);
    expect(freq).toBeCloseTo((bin * SAMPLE_RATE) / FFT_SIZE, 5);
    expect(binForFrequency(freq, SAMPLE_RATE, FFT_SIZE)).toBe(bin);
  });

  it("maps 0 Hz to bin 0", () => {
    expect(binForFrequency(0, SAMPLE_RATE, FFT_SIZE)).toBe(0);
  });
});

describe("findDominantFrequency", () => {
  function makeSpectrum(peakBin: number, binCount = FFT_SIZE / 2): Uint8Array {
    const data = new Uint8Array(binCount);
    data[peakBin - 1] = 40;
    data[peakBin] = 200;
    data[peakBin + 1] = 40;
    return data;
  }

  it("returns null for silence", () => {
    const silence = new Uint8Array(FFT_SIZE / 2);
    expect(findDominantFrequency(silence, SAMPLE_RATE, FFT_SIZE)).toBeNull();
  });

  it("finds the bin with the highest magnitude within the audible range", () => {
    const peakBin = 200; // well within 20Hz-20kHz for these params
    const spectrum = makeSpectrum(peakBin);
    const result = findDominantFrequency(spectrum, SAMPLE_RATE, FFT_SIZE);
    expect(result).not.toBeNull();
    expect(result!.binIndex).toBe(peakBin);
    expect(result!.magnitude).toBe(200);
    // Symmetric neighbours -> interpolation should not shift the estimate.
    expect(result!.frequency).toBeCloseTo(
      frequencyForBin(peakBin, SAMPLE_RATE, FFT_SIZE),
      5,
    );
  });

  it("ignores energy outside the requested min/max range", () => {
    const belowRangeBin = binForFrequency(5, SAMPLE_RATE, FFT_SIZE); // 5Hz < default 20Hz min
    const spectrum = new Uint8Array(FFT_SIZE / 2);
    spectrum[belowRangeBin] = 255;
    expect(findDominantFrequency(spectrum, SAMPLE_RATE, FFT_SIZE)).toBeNull();
  });

  it("skews the interpolated frequency toward the louder neighbour", () => {
    const peakBin = 200;
    const data = new Uint8Array(FFT_SIZE / 2);
    data[peakBin - 1] = 10;
    data[peakBin] = 200;
    data[peakBin + 1] = 60; // louder on the right -> estimate shifts right
    const result = findDominantFrequency(data, SAMPLE_RATE, FFT_SIZE);
    expect(result!.frequency).toBeGreaterThan(
      frequencyForBin(peakBin, SAMPLE_RATE, FFT_SIZE),
    );
  });
});

describe("calculateRms", () => {
  it("is 0 for a flat (silent) signal centered at 128", () => {
    const silent = new Uint8Array(1024).fill(128);
    expect(calculateRms(silent)).toBe(0);
  });

  it("is 1 for a full-scale square wave", () => {
    const squareWave = new Uint8Array(1024);
    squareWave.fill(255, 0, 512);
    squareWave.fill(0, 512);
    expect(calculateRms(squareWave)).toBeCloseTo(1, 1);
  });
});

describe("noteFromFrequency", () => {
  it("identifies A4 (440Hz) exactly", () => {
    const note = noteFromFrequency(440);
    expect(note).toEqual({ name: "A", octave: 4, cents: 0 });
  });

  it("identifies middle C (C4, ~261.63Hz)", () => {
    const note = noteFromFrequency(261.63);
    expect(note?.name).toBe("C");
    expect(note?.octave).toBe(4);
    expect(Math.abs(note?.cents ?? 100)).toBeLessThan(5);
  });

  it("returns null for non-positive input", () => {
    expect(noteFromFrequency(0)).toBeNull();
    expect(noteFromFrequency(-100)).toBeNull();
  });
});
