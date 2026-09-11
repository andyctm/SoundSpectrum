"use client";

import type { LucideIcon } from "lucide-react";
import { Activity, AudioLines, BarChart3, Flame, Mic } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AudioEngineProvider } from "@/components/providers/audio-engine-provider";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { SourceControls } from "@/components/dashboard/source-controls";
import { StatsPanel } from "@/components/dashboard/stats-panel";
import { WaveformChart } from "@/components/dashboard/waveform-chart";
import { SpectrumChart } from "@/components/dashboard/spectrum-chart";
import { SpectrogramHeatmap } from "@/components/dashboard/spectrogram-heatmap";
import { ExportButton } from "@/components/dashboard/export-button";

const CAPTURE_ID = "analyzer-dashboard-capture";

/** Chart-token index (1-5) each section's icon draws its tint from — ties section identity to its data viz. */
type ChartTone = 1 | 2 | 3 | 4 | 5;

function SectionIcon({ icon: Icon, tone }: { icon: LucideIcon; tone: ChartTone }) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-lg"
      style={{
        color: `var(--color-chart-${tone})`,
        backgroundColor: `color-mix(in oklch, var(--color-chart-${tone}) 16%, transparent)`,
      }}
    >
      <Icon className="size-[18px]" />
    </span>
  );
}

function SectionHeader({
  icon,
  tone,
  title,
  description,
}: {
  icon: LucideIcon;
  tone: ChartTone;
  title: string;
  description: string;
}) {
  return (
    <CardHeader className="flex-row items-center gap-3">
      <SectionIcon icon={icon} tone={tone} />
      <div className="flex flex-col gap-1">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
    </CardHeader>
  );
}

export function AnalyzerDashboard() {
  return (
    <AudioEngineProvider>
      <div className="flex min-h-full flex-col">
        <header className="sticky top-0 z-10 border-b border-border/70 bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="relative flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span
                  aria-hidden
                  className="absolute inset-0 -z-10 rounded-full bg-primary/50 blur-lg"
                />
                <AudioLines className="size-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold leading-tight tracking-tight">
                  Sound Frequency Analyzer
                </h1>
                <p className="text-xs text-muted-foreground">
                  Real-time FFT spectrum, waveform, and frequency detection
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ExportButton targetId={CAPTURE_ID} />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
          <div id={CAPTURE_ID} className="flex flex-col gap-6 bg-background">
            <Card>
              <SectionHeader
                icon={Mic}
                tone={2}
                title="Audio Source"
                description="Analyze live microphone input or an uploaded audio file."
              />
              <CardContent>
                <SourceControls />
              </CardContent>
            </Card>

            <Card>
              <SectionHeader
                icon={Activity}
                tone={1}
                title="Frequency Detection"
                description="Dominant frequency updates live; peak frequency holds the loudest component seen this session."
              />
              <CardContent>
                <StatsPanel />
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <SectionHeader
                  icon={AudioLines}
                  tone={2}
                  title="Waveform"
                  description="Time-domain signal"
                />
                <CardContent>
                  <WaveformChart />
                </CardContent>
              </Card>

              <Card>
                <SectionHeader
                  icon={BarChart3}
                  tone={4}
                  title="FFT Spectrum"
                  description="Magnitude vs. frequency (log scale)"
                />
                <CardContent>
                  <SpectrumChart />
                </CardContent>
              </Card>
            </div>

            <Card>
              <SectionHeader
                icon={Flame}
                tone={5}
                title="Frequency Heatmap"
                description="Scrolling spectrogram — time (x), frequency (y), intensity (color)"
              />
              <CardContent>
                <SpectrogramHeatmap />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AudioEngineProvider>
  );
}
