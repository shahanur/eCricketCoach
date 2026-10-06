import { Request } from 'express';

// APP_ORIGIN may list several browser-facing origins (comma-separated), e.g.
// "http://localhost:3000,https://my-tunnel.ngrok-free.dev". The first is the default.
const allowedOrigins = (process.env.APP_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)
  .map(value => {
    try {
      return new URL(value).origin;
    } catch {
      return null;
    }
  })
  .filter((value): value is string => Boolean(value));

if (!allowedOrigins.length) allowedOrigins.push('http://localhost:3000');

export const isAllowedAppOrigin = (origin: unknown): origin is string =>
  typeof origin === 'string' && allowedOrigins.includes(origin);

// Picks the configured origin whose host matches the incoming request (via nginx/ngrok Host
// headers), so OAuth redirects return to whichever URL the user is browsing on.
export function resolveAppOrigin(req: Request): string {
  const forwardedHost = String(req.get('x-forwarded-host') || '').split(',')[0].trim();
  const host = (forwardedHost || req.get('host') || '').toLowerCase();
  return allowedOrigins.find(origin => new URL(origin).host.toLowerCase() === host) || allowedOrigins[0];
}
