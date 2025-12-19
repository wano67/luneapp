import type { NextConfig } from 'next';

const distDir = process.env.NEXT_DIST_DIR?.trim() || '.next';

const nextConfig: NextConfig = {
  // Allow separate dist dirs for dev vs build to avoid .next races (dev server vs build)
  distDir,
};

export default nextConfig;
