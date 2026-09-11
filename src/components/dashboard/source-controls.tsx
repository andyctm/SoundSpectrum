"use client";

import { useRef, useState } from "react";
import { Mic, Square, Upload, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useAudioEngine } from "@/components/providers/audio-engine-provider";
import { useAnalyzerStatus } from "@/hooks/use-analyzer-status";
import { FFT_SIZE_OPTIONS, type FftSizeOption } from "@/lib/audio/audio-engine";

const STATUS_LABEL: Record<string, string> = {
  idle: "Idle",
  "requesting-permission": "Requesting mic access\u2026",
  listening: "Listening",
  playing: "Playing",
  paused: "Paused",
  stopped: "Stopped",
  error: "Error",
};

export function SourceControls() {
  const engine = useAudioEngine();
  const snapshot = useAnalyzerStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const isFile = snapshot.source === "file";
  const isListening = snapshot.status === "listening";
  const isPlaying = snapshot.status === "playing";

  async function handleMicToggle() {
    if (isListening) {
      engine.stop();
      return;
    }
    try {
      setPendingAction("mic");
      await engine.startMicrophone();
    } catch {
      // Surfaced via snapshot.error / the Alert below.
    } finally {
      setPendingAction(null);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPendingAction("file");
      await engine.loadFile(file);
    } catch {
      // Surfaced via snapshot.error / the Alert below.
    } finally {
      setPendingAction(null);
      e.target.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Status
          </span>
          <Badge
            variant={snapshot.status === "error" ? "destructive" : "outline"}
            className="capitalize"
          >
            {STATUS_LABEL[snapshot.status] ?? snapshot.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground">FFT Size</Label>
          <Slider
            aria-label="FFT Size"
            className="w-[120px]"
            min={0}
            max={FFT_SIZE_OPTIONS.length - 1}
            step={1}
            value={[FFT_SIZE_OPTIONS.indexOf(snapshot.fftSize as FftSizeOption)]}
            onValueChange={([index]) => engine.setFftSize(FFT_SIZE_OPTIONS[index])}
            aria-valuetext={String(snapshot.fftSize)}
          />
          <span className="w-12 text-xs tabular-nums text-muted-foreground">
            {snapshot.fftSize}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3">
          <span className="text-xs font-medium text-muted-foreground">
            Microphone
          </span>
          <Button
            onClick={handleMicToggle}
            disabled={pendingAction === "mic" || (isFile && isPlaying)}
            variant={isListening ? "destructive" : "default"}
            className="w-full"
          >
            {isListening ? <Square /> : <Mic />}
            {isListening ? "Stop Listening" : "Start Microphone"}
          </Button>
        </div>

        <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3">
          <span className="text-xs font-medium text-muted-foreground">
            Audio File
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Upload audio file"
          />
          {!isFile ? (
            <Button
              variant="outline"
              className="w-full"
              disabled={pendingAction === "file" || isListening}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload /> Choose File
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => (isPlaying ? engine.pause() : engine.play())}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause /> : <Play />}
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => engine.stop()}
                aria-label="Stop"
              >
                <Square />
              </Button>
              <span
                className="truncate text-xs text-muted-foreground"
                title={snapshot.fileName ?? undefined}
              >
                {snapshot.fileName}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                className="ml-auto"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Choose a different file"
              >
                <RotateCcw />
              </Button>
            </div>
          )}
        </div>
      </div>

      {snapshot.status === "error" && snapshot.error && (
        <Alert variant="destructive">
          <AlertTitle>Audio source error</AlertTitle>
          <AlertDescription>{snapshot.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
