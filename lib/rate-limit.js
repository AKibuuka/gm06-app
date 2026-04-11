// Simple in-memory rate limiter (per-process, resets on restart)
// For production at scale, use Redis or similar
const attempts = new Map();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (now - entry.start > WINDOW_MS) attempts.delete(key);
  }
}, 5 * 60 * 1000);

export function checkRateLimit(key, { windowMs = WINDOW_MS, max = MAX_ATTEMPTS } = {}) {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.start > windowMs) {
    attempts.set(key, { count: 1, start: now });
    return { allowed: true, remaining: max - 1 };
  }

  entry.count++;
  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.start + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining: max - entry.count };
}
