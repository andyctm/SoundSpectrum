"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Chart, type ChartData, type ChartOptions } from "chart.js";
import { Line } from "react-chartjs-2";
import { useAudioEngine } from "@/components/providers/audio-engine-provider";
import { ensureChartJsRegistered } from "@/lib/chart-setup";

ensureChartJsRegistered();

const DISPLAY_POINTS = 256;

function readCssColor(variable: string): string {
  if (typeof window === "undefined") return "#3b82f6";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
}

function downsample(source: Uint8Array, targetLength: number): number[] {
  const step = source.length / targetLength;
  const out = new Array<number>(targetLength);
  for (let i = 0; i < targetLength; i++) {
    const sample = source[Math.floor(i * step)] ?? 128;
    out[i] = (sample - 128) / 128;
  }
  return out;
}

/** Real-time oscilloscope view of the analyser's time-domain (waveform) samples. */
export function WaveformChart() {
  const engine = useAudioEngine();
  const chartRef = useRef<Chart<"line">>(null);
  const { resolvedTheme } = useTheme();

  const data: ChartData<"line"> = {
    labels: Array.from({ length: DISPLAY_POINTS }, (_, i) => i),
    datasets: [
      {
        data: new Array(DISPLAY_POINTS).fill(0),
        borderWidth: 1.5,
        borderColor: readCssColor("--color-chart-2"),
        pointRadius: 0,
        tension: 0.15,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    normalized: true,
    scales: {
      x: { display: false },
      y: { min: -1, max: 1, display: false },
    },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const color = readCssColor("--color-chart-2");
    chart.data.datasets[0].borderColor = color;
    chart.update("none");
  }, [resolvedTheme]);

  useEffect(() => {
    return engine.subscribeFrames((frame) => {
      const chart = chartRef.current;
      if (!chart) return;
      chart.data.datasets[0].data = downsample(frame.timeDomain, DISPLAY_POINTS);
      chart.update("none");
    });
  }, [engine]);

  return (
    <div className="h-48 w-full">
      <Line ref={chartRef} data={data} options={options} />
    </div>
  );
}
