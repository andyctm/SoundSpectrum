"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportNodeToPng } from "@/lib/export-image";

export function ExportButton({ targetId }: { targetId: string }) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    const node = document.getElementById(targetId);
    if (!node) {
      toast.error("Nothing to export yet.");
      return;
    }
    setIsExporting(true);
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await exportNodeToPng(node, `frequency-analyzer-${stamp}.png`);
      toast.success("Snapshot exported as PNG.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to export snapshot.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={isExporting}>
      {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
      Export PNG
    </Button>
  );
}
