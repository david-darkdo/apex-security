/**
 * Canonical site origin for absolute URLs in metadata, sitemaps, and OpenGraph tags.
 * Falls back to localhost in non-browser/SSR environments where VERCEL_URL or window is absent.
 */
export function getSiteOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://apex-security-ltd.vercel.app";
}

export const SITE_ORIGIN = getSiteOrigin();
