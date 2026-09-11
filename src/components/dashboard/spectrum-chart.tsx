"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Chart, type ChartData, type ChartOptions } from "chart.js";
import { Line } from "react-chartjs-2";
import { useAudioEngine } from "@/components/providers/audio-engine-provider";
import { ensureChartJsRegistered } from "@/lib/chart-setup";
import {
  MAX_AUDIBLE_HZ,
  MIN_AUDIBLE_HZ,
  frequencyForBin,
} from "@/lib/audio/fft-utils";

ensureChartJsRegistered();

const MAX_DISPLAY_BINS = 512;

function readCssColor(variable: string): string {
  if (typeof window === "undefined") return "#8b5cf6";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
}

/** Real-time FFT magnitude spectrum, plotted on a log-frequency axis (how humans perceive pitch). */
export function SpectrumChart() {
  const engine = useAudioEngine();
  const chartRef = useRef<Chart<"line", { x: number; y: number }[]>>(null);
  const { resolvedTheme } = useTheme();

  const data: ChartData<"line", { x: number; y: number }[]> = {
    datasets: [
      {
        data: [],
        borderWidth: 1.5,
        borderColor: readCssColor("--color-chart-4"),
        backgroundColor: readCssColor("--color-chart-4"),
        fill: true,
        pointRadius: 0,
        tension: 0.05,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    parsing: false,
    scales: {
      x: {
        type: "logarithmic",
        min: MIN_AUDIBLE_HZ,
        max: MAX_AUDIBLE_HZ,
        title: { display: true, text: "Frequency (Hz)" },
      },
      y: {
        min: 0,
        max: 255,
        title: { display: true, text: "Magnitude" },
      },
    },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const color = readCssColor("--color-chart-4");
    chart.data.datasets[0].borderColor = color;
    chart.data.datasets[0].backgroundColor = color;
    chart.update("none");
  }, [resolvedTheme]);

  useEffect(() => {
    return engine.subscribeFrames((frame) => {
      const chart = chartRef.current;
      if (!chart) return;
      const step = Math.max(1, Math.floor(frame.binCount / MAX_DISPLAY_BINS));
      const points: { x: number; y: number }[] = [];
      for (let i = 1; i < frame.binCount; i += step) {
        const x = frequencyForBin(i, frame.sampleRate, frame.fftSize);
        if (x < MIN_AUDIBLE_HZ || x > MAX_AUDIBLE_HZ) continue;
        points.push({ x, y: frame.frequency[i] });
      }
      chart.data.datasets[0].data = points;
      chart.update("none");
    });
  }, [engine]);

  return (
    <div className="h-64 w-full">
      <Line ref={chartRef} data={data} options={options} />
    </div>
  );
}
