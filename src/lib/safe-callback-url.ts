/**
 * NextAuth and our /auth page pass callbackUrl via query string. Malformed values
 * (e.g. the literal "null", protocol-relative URLs, or paths with "..") would
 * otherwise make router.push land on a non-existent route → Next.js 404.
 */
export function getSafeCallbackPath(raw: string | null): string {
  const fallback = "/";
  if (raw == null) return fallback;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }

  const t = decoded.trim();
  if (!t) return fallback;
  const lower = t.toLowerCase();
  if (lower === "null" || lower === "undefined") return fallback;
  if (t.includes("..")) return fallback;
  if (t.startsWith("//")) return fallback;

  if (t.startsWith("/")) {
    const withoutQuery = t.split("?")[0].split("#")[0];
    if (withoutQuery.includes("//")) return fallback;
    return t;
  }

  try {
    if (typeof window !== "undefined") {
      const u = new URL(t);
      if (u.origin === window.location.origin) {
        return `${u.pathname}${u.search}${u.hash}`;
      }
    }
  } catch {
    /* not an absolute URL */
  }

  return fallback;
}
