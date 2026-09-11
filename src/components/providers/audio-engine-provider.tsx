"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { AudioAnalyzerEngine } from "@/lib/audio/audio-engine";

const AudioEngineContext = createContext<AudioAnalyzerEngine | null>(null);

/** Exported so tests can render dashboard panels against a fake engine. */
export { AudioEngineContext };

/**
 * Owns the single, page-lifetime AudioAnalyzerEngine instance. A context
 * (rather than prop-drilling) lets any dashboard panel subscribe to raw
 * frames itself instead of funnelling 60fps data through React state.
 */
export function AudioEngineProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [engine] = useState(() => new AudioAnalyzerEngine());

  useEffect(() => {
    return () => engine.dispose();
  }, [engine]);

  return (
    <AudioEngineContext.Provider value={engine}>
      {children}
    </AudioEngineContext.Provider>
  );
}

export function useAudioEngine(): AudioAnalyzerEngine {
  const engine = useContext(AudioEngineContext);
  if (!engine) {
    throw new Error("useAudioEngine must be used within an AudioEngineProvider");
  }
  return engine;
}
