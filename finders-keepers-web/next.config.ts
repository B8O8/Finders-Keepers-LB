import type { NextConfig } from "next";

/**
 * Hosts that next/image is allowed to optimise.
 *
 * Supabase stays for images uploaded before the move to self-hosted storage —
 * those URLs remain valid and must keep rendering.
 *
 * The API host is derived from NEXT_PUBLIC_API_URL (baked in at build time by
 * the Dockerfile) rather than hardcoded, because new uploads are served from
 * <API_DOMAIN>/uploads and that domain differs per environment. Without this,
 * next/image rejects every locally-uploaded image at runtime with "hostname is
 * not configured" — a failure the build cannot catch, since the src is dynamic.
 */
function imageRemotePatterns() {
  const patterns: NonNullable<
    NonNullable<NextConfig["images"]>["remotePatterns"]
  > = [{ protocol: "https", hostname: "**.supabase.co" }];

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return patterns;

  try {
    const { protocol, hostname } = new URL(apiUrl);
    if (protocol === "https:" || protocol === "http:") {
      patterns.push({
        protocol: protocol === "https:" ? "https" : "http",
        hostname,
      });
    }
  } catch {
    // A malformed NEXT_PUBLIC_API_URL should not break the build; the app has
    // bigger problems, and they'll surface loudly at request time.
  }

  return patterns;
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  images: {
    remotePatterns: imageRemotePatterns(),
  },
};

export default nextConfig;
