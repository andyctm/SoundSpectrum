"use client";

import { useEffect, useRef } from "react";
import { useAudioEngine } from "@/components/providers/audio-engine-provider";
import {
  MAX_AUDIBLE_HZ,
  MIN_AUDIBLE_HZ,
  binForFrequency,
} from "@/lib/audio/fft-utils";

const MIN_LOG = Math.log10(MIN_AUDIBLE_HZ);
const MAX_LOG = Math.log10(MAX_AUDIBLE_HZ);

/** Maps a 0..255 magnitude to a dark-to-hot color, matching a classic spectrogram palette. */
function magnitudeToRgb(magnitude: number): [number, number, number] {
  const t = magnitude / 255;
  const hue = 240 - t * 240; // blue (quiet) -> red (loud)
  const lightness = 6 + t * 46;
  return hslToRgb(hue, 0.85, lightness / 100);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/**
 * Real-time scrolling spectrogram (frequency heatmap): time on the x-axis,
 * log-scaled frequency on the y-axis, magnitude encoded as color. Rendered
 * with raw canvas pixel manipulation rather than Chart.js — at 60fps a
 * per-pixel heatmap needs direct ImageData writes; a Chart.js matrix plugin
 * would add a dependency and re-layout cost with no visual benefit here.
 */
export function SpectrogramHeatmap() {
  const engine = useAudioEngine();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return engine.subscribeFrames((frame) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { width, height } = canvas;
      if (width < 2 || height < 1) return;

      ctx.drawImage(canvas, 1, 0, width - 1, height, 0, 0, width - 1, height);

      const column = ctx.createImageData(1, height);
      for (let y = 0; y < height; y++) {
        const frac = 1 - y / (height - 1 || 1);
        const freq = 10 ** (MIN_LOG + frac * (MAX_LOG - MIN_LOG));
        const bin = binForFrequency(freq, frame.sampleRate, frame.fftSize);
        const magnitude = frame.frequency[bin] ?? 0;
        const [r, g, b] = magnitudeToRgb(magnitude);
        const offset = y * 4;
        column.data[offset] = r;
        column.data[offset + 1] = g;
        column.data[offset + 2] = b;
        column.data[offset + 3] = 255;
      }
      ctx.putImageData(column, width - 1, 0);
    });
  }, [engine]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="h-56 w-full overflow-hidden rounded-md bg-black"
      >
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{MIN_AUDIBLE_HZ} Hz</span>
        <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-[hsl(240_85%_6%)] via-[hsl(120_85%_29%)] to-[hsl(0_85%_52%)]" />
        <span>{(MAX_AUDIBLE_HZ / 1000).toFixed(0)} kHz</span>
      </div>
    </div>
  );
}
