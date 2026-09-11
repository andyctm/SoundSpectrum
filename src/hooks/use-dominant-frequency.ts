"use client";

import { useEffect, useRef, useState } from "react";
import { useAudioEngine } from "@/components/providers/audio-engine-provider";
import type { DominantFrequency, PeakFrequency } from "@/lib/audio/types";

const UPDATE_INTERVAL_MS = 100;

/**
 * Throttled dominant/peak frequency + RMS readout for numeric UI (stat
 * cards). Chart/heatmap panels subscribe to raw frames directly instead of
 * going through React state, so this hook is safe to re-render on.
 */
export function useDominantFrequency(): {
  dominant: DominantFrequency | null;
  peak: PeakFrequency | null;
  rms: number;
  resetPeak: () => void;
} {
  const engine = useAudioEngine();
  const [state, setState] = useState<{
    dominant: DominantFrequency | null;
    peak: PeakFrequency | null;
    rms: number;
  }>({ dominant: null, peak: null, rms: 0 });
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    return engine.subscribeDominant((dominant, peak, rms) => {
      const now = performance.now();
      if (now - lastUpdateRef.current < UPDATE_INTERVAL_MS) return;
      lastUpdateRef.current = now;
      setState({ dominant, peak, rms });
    });
  }, [engine]);

  return { ...state, resetPeak: () => engine.resetPeak() };
}
