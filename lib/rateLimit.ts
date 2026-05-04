type Entry = { count: number; resetAt: number };
const hits = new Map<string, Entry>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits.entries()) {
    if (entry.resetAt < now) hits.delete(ip);
  }
}, 5 * 60 * 1000);

export function rateLimit(ip: string, max = 30, windowMs = 60 * 60 * 1000) {
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
