import express, { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { apiRouter } from './server/routes.js';
import { dbService } from './server/db.js';
import { getPublicAppUrl } from './server/urlHelper.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Helper to escape HTML characters
function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Social media crawler detector
function isSocialCrawler(userAgent?: string): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return (
    ua.includes('facebookexternalhit') ||
    ua.includes('facebot') ||
    ua.includes('twitterbot') ||
    ua.includes('discordbot') ||
    ua.includes('telegrambot') ||
    ua.includes('whatsapp') ||
    ua.includes('linkedinbot') ||
    ua.includes('slackbot') ||
    ua.includes('googlebot') ||
    ua.includes('bingbot') ||
    ua.includes('applebot') ||
    ua.includes('pinterest') ||
    ua.includes('redditbot') ||
    ua.includes('skypeuripreview') ||
    ua.includes('vkshare') ||
    ua.includes('embedly') ||
    ua.includes('quora link preview') ||
    ua.includes('outbrain') ||
    ua.includes('bot') ||
    ua.includes('crawler') ||
    ua.includes('spider')
  );
}

// Mount API routes
app.use('/api', apiRouter);

// Error handling middleware for API routes - ensures JSON is always returned, NEVER an HTML error page
app.use((err: any, req: Request, res: Response, next: any) => {
  if (req.path.startsWith('/api') || req.headers.accept?.includes('application/json')) {
    console.error('API Error:', err);
    const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File size exceeds maximum 10MB limit.'
      : (err.message || 'An error occurred during request processing.');
    return res.status(status).json({
      error: message,
      success: false
    });
  }
  next(err);
});

// --- Public Image Link Endpoint: /share/:shortId and /i/:shortId ---
// Handles crawlers (returns server-rendered OG metadata) and humans (records click & fast HTTP 302 redirect)
const handlePublicLink = (req: Request, res: Response) => {
  const { shortId } = req.params;
  const link = dbService.getLinkByShortId(shortId);

  if (!link) {
    return res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Image Link Not Found</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #0a0a0c; color: #fff; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { text-align: center; padding: 32px; border: 1px solid #262626; border-radius: 16px; background: #121215; max-width: 400px; }
    h2 { margin-top: 0; font-size: 20px; }
    p { color: #a3a3a3; font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
    a { background: #0284c7; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 13px; display: inline-block; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Image Link Not Found</h2>
    <p>This image link has expired, was deleted, or never existed.</p>
    <a href="/">Create New Image Link</a>
  </div>
</body>
</html>`);
  }

  if (link.status === 'disabled') {
    return res.status(403).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Image Link Disabled</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #0a0a0c; color: #fff; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { text-align: center; padding: 32px; border: 1px solid #7f1d1d; border-radius: 16px; background: #1a0f12; max-width: 420px; }
    h2 { margin-top: 0; color: #f87171; font-size: 20px; }
    p { color: #d4d4d8; font-size: 14px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h2>This Image Link has been disabled.</h2>
    <p>The owner or administrator has temporarily deactivated this redirect destination.</p>
  </div>
</body>
</html>`);
  }

  const userAgent = req.headers['user-agent'] || '';
  const isCrawler = req.query.preview === '1' || req.query.crawler === '1' || isSocialCrawler(userAgent);
  const appUrl = getPublicAppUrl(req);
  const canonicalUrl = `${appUrl}/share/${link.shortId}`;

  let domain = 'Website';
  try {
    domain = new URL(link.destinationUrl).hostname;
  } catch {
    // fallback
  }

  // --- CRAWLER FLOW: Return HTTP 200 with complete server-rendered Open Graph & Twitter metadata ---
  if (isCrawler) {
    const escDesc = escapeHtml(link.description);
    const escDomain = escapeHtml(domain);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escDomain} - ${escDesc}</title>
  <meta name="description" content="${escDesc}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <!-- Open Graph metadata for Facebook, Discord, Telegram, WhatsApp -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escDomain}">
  <meta property="og:description" content="${escDesc}">
  <meta property="og:image" content="${link.processedImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="${escDomain}">

  <!-- Twitter / X Card metadata -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${escDomain}">
  <meta name="twitter:description" content="${escDesc}">
  <meta name="twitter:image" content="${link.processedImageUrl}">
</head>
<body style="font-family:system-ui,sans-serif;background:#09090b;color:#f4f4f5;padding:24px;text-align:center;">
  <main style="max-width:600px;margin:40px auto;background:#18181b;padding:24px;border-radius:12px;border:1px solid #27272a;">
    <img src="${link.processedImageUrl}" alt="${escDesc}" style="width:100%;height:auto;border-radius:8px;aspect-ratio:16/9;object-fit:cover;">
    <h1 style="font-size:18px;margin:16px 0 8px;">${escDesc}</h1>
    <p style="color:#a1a1aa;font-size:13px;margin-bottom:20px;">Destination: ${escDomain}</p>
    <a href="${escapeHtml(link.destinationUrl)}" style="background:#0284c7;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;">Visit Website &rarr;</a>
  </main>
</body>
</html>`;

    return res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
  }

  // --- HUMAN VISITOR FLOW: Record click and fast redirect to destination ---
  const referer = (req.headers['referer'] as string) || '';
  try {
    dbService.recordClick(link.id, link.shortId, {
      userAgent,
      referer
    });
  } catch (err: any) {
    // Analytics failure must NEVER block the redirect or dump to stderr
    if (process.env.DEBUG_ANALYTICS) {
      console.warn('Click recording notice (non-blocking):', err?.message);
    }
  }

  // Ensure human redirect is not improperly cached
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Fast HTTP 302 redirect directly to destination (immediate, no HTML, no JS, no delay)
  return res.redirect(302, link.destinationUrl);
};

app.get('/share/:shortId', handlePublicLink);
app.get('/i/:shortId', handlePublicLink);


async function startServer() {
  let vite: any = null;

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist'), { index: false }));
  }

  // Universal HTML handler for SPA pages (Generator, Dashboard, Crawler Test, Admin)
  app.use('*', async (req: Request, res: Response) => {
    const url = req.originalUrl;

    try {
      let template: string;
      if (!isProduction) {
        template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
      } else {
        template = fs.readFileSync(path.resolve(process.cwd(), 'dist', 'index.html'), 'utf-8');
      }

      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e: any) {
      if (!isProduction && vite) {
        vite.ssrFixStacktrace(e);
      }
      console.error('SSR Render Error:', e);
      res.status(500).end(e.stack);
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ImageLink Generator running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
