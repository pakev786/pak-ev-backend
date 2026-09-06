/**
 * Small in-process rate limiter used to slow down credential stuffing, OTP
 * brute force and mail-bombing. It is intentionally dependency free; for a
 * multi-instance deployment back it with Redis (or express-rate-limit + a store)
 * so the counters are shared between processes.
 */
const buckets = new Map();

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

const cleanup = () => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
};

const timer = setInterval(cleanup, CLEANUP_INTERVAL_MS);
if (typeof timer.unref === "function") timer.unref();

const clientKey = (req) => {
  // req.ip honours "trust proxy" when it is configured on the app.
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  return ip;
};

export const rateLimit = ({
  windowMs = 15 * 60 * 1000,
  max = 20,
  name = "default",
  message = "Too many requests. Please try again later.",
  keyGenerator
} = {}) => {
  return (req, res, next) => {
    const key = `${name}:${keyGenerator ? keyGenerator(req) : clientKey(req)}`;
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil((entry.resetAt - now) / 1000)));

    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ message });
    }

    next();
  };
};

export default rateLimit;
