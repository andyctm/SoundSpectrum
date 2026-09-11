# Sound Frequency Analyzer

A responsive, real-time sound frequency analyzer built with Next.js, TypeScript, Tailwind CSS,
shadcn/ui, Chart.js, and the Web Audio API. Analyze microphone input or an uploaded audio file:
waveform, FFT spectrum, dominant/peak frequency detection, a scrolling frequency heatmap,
PNG export, and dark mode — all client-side, deployable as static files to GitHub Pages.

See [docs/SDD.md](docs/SDD.md) for the full design document (requirements, architecture
decisions, tests, risks, and deployment checklist).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Microphone capture requires a secure
context (localhost is fine; production requires HTTPS, which GitHub Pages provides).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest unit/integration suite |
| `npm run build` | Type-check and produce a static export in `out/` |

## Deployment (GitHub Pages)

1. Push to `main` — `.github/workflows/deploy.yml` lints, tests, builds a static export, and
   deploys it to GitHub Pages via GitHub Actions.
2. In the repository settings, set **Settings → Pages → Build and deployment** source to
   **GitHub Actions**.
3. The site's `basePath` (`/SoundSpectrum`) is derived automatically from the repo name
   in `next.config.ts` when running under GitHub Actions; update `repoName` there if the repo
   is renamed.

## Project structure

```
src/
  app/                     Next.js App Router entry (layout, page)
  components/
    dashboard/             Dashboard panels (controls, stats, charts, heatmap, export, theme)
    providers/              AudioEngineProvider, ThemeProvider
    ui/                     shadcn/ui primitives
  hooks/                   useAnalyzerStatus, useDominantFrequency
  lib/
    audio/                 AudioAnalyzerEngine, FFT math utilities, shared types
    chart-setup.ts         Chart.js registration
    export-image.ts        PNG export helper
docs/SDD.md                Full software design document
```

