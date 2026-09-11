import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  LogarithmicScale,
  PointElement,
  Tooltip,
} from "chart.js";

let registered = false;

/** Registers only the Chart.js elements the dashboard actually uses (keeps the bundle lean). */
export function ensureChartJsRegistered(): void {
  if (registered) return;
  Chart.register(
    CategoryScale,
    LinearScale,
    LogarithmicScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
  );
  registered = true;
}
