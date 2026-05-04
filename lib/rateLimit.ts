// Simple in-memory IP rate limiter.
// Good enough for MVP and small launches. For production, swap in
// Upstash Redis (free tier, 10k commands/day) so limits persist
// across server restarts and multiple Vercel function instances.

type Entry = { count: number; resetAt: number };
const hits = new Map<string, Entry>();

// Clean up old entries periodically (prevents memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits.entries()) {
    if (entry.resetAt < now) hits.delete(ip);
  }
}, 5 * 60 * 1000); // every 5 minutes

export function rateLimit(
  ip: string,
  max = 30,
  windowMs = 60 * 60 * 1000 // 1 hour
) {
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, resetAt: now + windowMs };
  }

  if (entry.count >= max) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { ok: true, remaining: max - entry.count, resetAt: entry.resetAt };
}
