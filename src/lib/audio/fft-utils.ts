import type { DominantFrequency, MusicalNote } from "./types";

/** Human audible range used to bound dominant-frequency search and chart axes. */
export const MIN_AUDIBLE_HZ = 20;
export const MAX_AUDIBLE_HZ = 20_000;

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

/** Maps an FFT bin index to the frequency (Hz) it represents. */
export function frequencyForBin(
  binIndex: number,
  sampleRate: number,
  fftSize: number,
): number {
  return (binIndex * sampleRate) / fftSize;
}

/** Inverse of {@link frequencyForBin}: which bin index best represents a frequency. */
export function binForFrequency(
  frequencyHz: number,
  sampleRate: number,
  fftSize: number,
): number {
  return Math.round((frequencyHz * fftSize) / sampleRate);
}

/**
 * Finds the strongest frequency component in a single analysis frame.
 *
 * Uses quadratic (parabolic) interpolation across the winning bin and its
 * neighbours to estimate a frequency between bins, which is far more precise
 * than the raw bin resolution (sampleRate / fftSize can be ~40Hz+ per bin).
 */
export function findDominantFrequency(
  frequencyData: Uint8Array,
  sampleRate: number,
  fftSize: number,
  minHz: number = MIN_AUDIBLE_HZ,
  maxHz: number = MAX_AUDIBLE_HZ,
): DominantFrequency | null {
  const lowBin = Math.max(1, binForFrequency(minHz, sampleRate, fftSize));
  const highBin = Math.min(
    frequencyData.length - 2,
    binForFrequency(maxHz, sampleRate, fftSize),
  );

  let bestBin = -1;
  let bestMagnitude = 0;
  for (let i = lowBin; i <= highBin; i++) {
    const magnitude = frequencyData[i];
    if (magnitude > bestMagnitude) {
      bestMagnitude = magnitude;
      bestBin = i;
    }
  }

  if (bestBin === -1 || bestMagnitude === 0) return null;

  const refinedBin = parabolicInterpolation(frequencyData, bestBin);
  return {
    frequency: frequencyForBin(refinedBin, sampleRate, fftSize),
    magnitude: bestMagnitude,
    binIndex: bestBin,
  };
}

/**
 * Refines a discrete peak bin to a fractional bin index using the classic
 * three-point parabolic interpolation formula (McAulay-Quatieri style),
 * assuming a log/linear magnitude curve around the true peak.
 */
function parabolicInterpolation(data: Uint8Array, peakBin: number): number {
  const left = data[peakBin - 1] ?? data[peakBin];
  const center = data[peakBin];
  const right = data[peakBin + 1] ?? data[peakBin];

  const denominator = left - 2 * center + right;
  if (denominator === 0) return peakBin;

  const offset = (0.5 * (left - right)) / denominator;
  // Guard against pathological input producing an offset outside a sane range.
  if (!Number.isFinite(offset) || Math.abs(offset) > 1) return peakBin;
  return peakBin + offset;
}

/** Root-mean-square level of byte time-domain samples, normalized to 0..1. */
export function calculateRms(timeDomain: Uint8Array): number {
  let sumSquares = 0;
  for (let i = 0; i < timeDomain.length; i++) {
    const normalized = (timeDomain[i] - 128) / 128;
    sumSquares += normalized * normalized;
  }
  return Math.sqrt(sumSquares / timeDomain.length);
}

/** Converts a frequency in Hz to the nearest musical note name, octave, and cents offset. */
export function noteFromFrequency(frequencyHz: number): MusicalNote | null {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) return null;

  const A4 = 440;
  const semitonesFromA4 = 12 * Math.log2(frequencyHz / A4);
  const roundedSemitones = Math.round(semitonesFromA4);
  const cents = Math.round((semitonesFromA4 - roundedSemitones) * 100);

  const noteIndex = ((roundedSemitones % 12) + 12 + 9) % 12; // +9 shifts A-relative to C-relative
  const octave = 4 + Math.floor((roundedSemitones + 9) / 12);

  return {
    name: NOTE_NAMES[noteIndex],
    octave,
    cents,
  };
}
