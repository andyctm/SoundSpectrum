"use client";

import { Activity, Gauge, RotateCcw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDominantFrequency } from "@/hooks/use-dominant-frequency";
import { noteFromFrequency } from "@/lib/audio/fft-utils";
import type { LucideIcon } from "lucide-react";

function formatHz(hz: number | undefined): string {
  if (!hz) return "\u2014";
  return hz >= 1000 ? `${(hz / 1000).toFixed(2)} kHz` : `${hz.toFixed(1)} Hz`;
}

function formatNote(hz: number | undefined): string {
  if (!hz) return "";
  const note = noteFromFrequency(hz);
  if (!note) return "";
  const sign = note.cents >= 0 ? "+" : "";
  return `${note.name}${note.octave} (${sign}${note.cents}\u00A2)`;
}

export function StatsPanel() {
  const { dominant, peak, rms, resetPeak } = useDominantFrequency();

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        icon={Activity}
        tone={2}
        label="Dominant Frequency"
        value={formatHz(dominant?.frequency)}
        sublabel={formatNote(dominant?.frequency)}
      />
      <StatCard
        icon={Gauge}
        tone={3}
        label="Peak Frequency (session)"
        value={formatHz(peak?.frequency)}
        sublabel={formatNote(peak?.frequency)}
        action={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={resetPeak}
                aria-label="Reset peak hold"
              >
                <RotateCcw />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset peak hold</TooltipContent>
          </Tooltip>
        }
      />
      <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ToneIcon icon={Volume2} tone={1} />
            Input Level (RMS)
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round(rms * 100)}%
          </span>
        </div>
        <Progress value={Math.min(100, rms * 140)} className="mt-auto" />
      </div>
    </div>
  );
}

type StatTone = 1 | 2 | 3;

function ToneIcon({ icon: Icon, tone }: { icon: LucideIcon; tone: StatTone }) {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-md"
      style={{
        color: `var(--color-chart-${tone})`,
        backgroundColor: `color-mix(in oklch, var(--color-chart-${tone}) 18%, transparent)`,
      }}
    >
      <Icon className="size-3" />
    </span>
  );
}

function StatCard({
  icon,
  tone,
  label,
  value,
  sublabel,
  action,
}: {
  icon: LucideIcon;
  tone: StatTone;
  label: string;
  value: string;
  sublabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-muted/60 p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <ToneIcon icon={icon} tone={tone} />
          {label}
        </span>
        {action}
      </div>
      <span className="font-mono text-2xl font-semibold tabular-nums">
        {value}
      </span>
      <span className="h-4 text-xs text-muted-foreground">{sublabel}</span>
    </div>
  );
}
