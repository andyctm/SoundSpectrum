import { toPng } from "html-to-image";

/**
 * Snapshots a DOM node to a PNG and triggers a browser download.
 * Uses html-to-image (SVG foreignObject serialization) rather than a
 * canvas-recording approach so it captures Tailwind/shadcn styling,
 * Chart.js canvases, and the heatmap canvas in one flattened image.
 */
export async function exportNodeToPng(
  node: HTMLElement,
  filename: string,
): Promise<void> {
  const backgroundColor = getComputedStyle(node).backgroundColor;
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    backgroundColor: backgroundColor || "#ffffff",
    cacheBust: true,
  });

  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
