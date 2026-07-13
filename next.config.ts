import type { NextConfig } from "next";

// Static export — deployable to GitHub Pages (or any static host).
// On a project page (username.github.io/t-t-wedding) set
// NEXT_PUBLIC_BASE_PATH=/t-t-wedding at build time; leave it empty for a
// custom domain or user site.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
