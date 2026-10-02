import { Request } from 'express';

export function getPublicAppUrl(req?: Request): string {
  // 1. process.env.PUBLIC_BASE_URL (must be a valid http/https URL)
  const envPublic = process.env.PUBLIC_BASE_URL?.trim();
  if (envPublic && (envPublic.startsWith('http://') || envPublic.startsWith('https://'))) {
    return envPublic.replace(/\/+$/, '');
  }

  // 2. process.env.APP_URL (must be a valid http/https URL, e.g. Cloud Run assigned domain)
  const envApp = process.env.APP_URL?.trim();
  if (envApp && (envApp.startsWith('http://') || envApp.startsWith('https://'))) {
    return envApp.replace(/\/+$/, '');
  }

  // 3. Request headers (X-Forwarded-Proto + Host from reverse proxy)
  if (req) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    if (host && !host.includes('undefined')) {
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  }

  return 'http://localhost:3000';
}

