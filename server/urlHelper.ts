import { Request } from 'express';

export function getPublicAppUrl(req?: Request): string {
  // 1. First priority: process.env.PUBLIC_BASE_URL
  if (process.env.PUBLIC_BASE_URL && process.env.PUBLIC_BASE_URL.trim() !== '') {
    return process.env.PUBLIC_BASE_URL.trim().replace(/\/+$/, '');
  }

  // 2. Second priority: process.env.APP_URL
  if (process.env.APP_URL && process.env.APP_URL.trim() !== '') {
    return process.env.APP_URL.trim().replace(/\/+$/, '');
  }

  // 2. Request headers (works on Cloud Run & local proxies)
  if (req) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    if (host) {
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  }

  return 'http://localhost:3000';
}
