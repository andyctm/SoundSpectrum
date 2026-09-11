"use client";

import { useEffect, useState } from "react";
import { useAudioEngine } from "@/components/providers/audio-engine-provider";
import type { AnalyzerSnapshot } from "@/lib/audio/types";

/** Low-frequency status readout (idle/listening/playing/error, timestamps, filename). */
export function useAnalyzerStatus(): AnalyzerSnapshot {
  const engine = useAudioEngine();
  const [snapshot, setSnapshot] = useState<AnalyzerSnapshot>(() =>
    engine.getSnapshot(),
  );

  useEffect(() => engine.subscribeStatus(setSnapshot), [engine]);

  return snapshot;
}
