import type { NextConfig } from "next";

// Repository name used as the GitHub Pages sub-path (https://<user>.github.io/<repo>/).
// Only the GitHub Pages workflow sets GH_PAGES_BUILD — other Actions workflows (e.g. the
// Hugging Face Spaces deploy, which serves from the domain root) must NOT get a basePath.
const repoName = "SoundSpectrum";
const isGithubPagesBuild = process.env.GH_PAGES_BUILD === "true";
const basePath = isGithubPagesBuild ? `/${repoName}` : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
