import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { dbService } from './db.js';
import { storageService, MAX_FILE_SIZE, ALLOWED_EXTENSIONS, FramingMode } from './storage.js';
import { botService, validateDestinationUrl, generateShortId } from './bot.js';
import { createRateLimiter } from './rateLimiter.js';
import { getPublicAppUrl } from './urlHelper.js';

export const apiRouter = Router();

// Configure multer for memory buffer handling
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`Invalid image type: ${ext}. Only JPG, JPEG, and PNG are supported.`));
    }
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Uploaded file is not a valid image.'));
    }
    cb(null, true);
  }
});

// Rate limiters
const createLimiter = createRateLimiter(60 * 1000, 30, 'Rate limit exceeded. Please wait a minute.');
const uploadLimiter = createRateLimiter(60 * 1000, 40, 'Upload rate limit exceeded.');

// --- Health Check ---
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// --- Image Serving ---
apiRouter.get('/images/:key', (req: Request, res: Response) => {
  const { key } = req.params;
  const filePath = storageService.getFilePath(key);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Image not found' });
  }

  const ext = path.extname(key).toLowerCase();
  let contentType = 'image/jpeg';
  if (ext === '.png') contentType = 'image/png';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(filePath);
});

// --- Image Upload Preview (For live preview before generation) ---
apiRouter.post('/upload-preview', uploadLimiter, upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const rawKey = storageService.saveRawBuffer(req.file.buffer, ext);
    const appUrl = getPublicAppUrl(req);

    return res.status(201).json({
      success: true,
      rawKey,
      previewUrl: `${appUrl}/api/images/${rawKey}`,
      fileName: req.file.originalname,
      size: req.file.size
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Image preview upload failed' });
  }
});

// --- Generate Image Link (PicLinks Core Workflow) ---
apiRouter.post('/image-links', createLimiter, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const destinationUrl = req.body.destinationUrl || req.body.destination_url;
    const description = (req.body.description || '').trim();
    const framingMode: FramingMode = req.body.framingMode === 'full' ? 'full' : 'crop_16_9';
    const telegramUserId = req.body.telegramUserId || req.body.telegram_user_id || undefined;
    const existingRawKey = req.body.rawKey;

    // 1. Validate Image
    let imageBuffer: Buffer;
    let originalFileName = 'upload.jpg';

    if (req.file) {
      imageBuffer = req.file.buffer;
      originalFileName = req.file.originalname;
    } else if (existingRawKey) {
      const existingPath = storageService.getFilePath(existingRawKey);
      if (!fs.existsSync(existingPath)) {
        return res.status(400).json({ error: 'Uploaded preview image expired or not found. Please re-upload.' });
      }
      imageBuffer = fs.readFileSync(existingPath);
      originalFileName = existingRawKey;
    } else {
      return res.status(400).json({ error: 'Please upload an image file (JPG or PNG up to 10MB).' });
    }

    // 2. Validate Destination URL
    const urlCheck = validateDestinationUrl(destinationUrl);
    if (!urlCheck.valid || !urlCheck.url) {
      return res.status(400).json({ error: urlCheck.error || 'Invalid destination URL.' });
    }

    // 3. Validate Description
    if (!description) {
      return res.status(400).json({ error: 'Link Description is required for social preview.' });
    }
    if (description.length > 500) {
      return res.status(400).json({ error: 'Link Description cannot exceed 500 characters.' });
    }

    // 4. Process Image with Sharp
    const processed = await storageService.processImage(imageBuffer, framingMode);

    // 5. Generate secure short ID & database record
    const shortId = generateShortId(8);
    const appUrl = getPublicAppUrl(req);
    const imageUrl = `${appUrl}/api/images/${processed.rawKey}`;
    const processedImageUrl = `${appUrl}/api/images/${processed.processedKey}`;

    const link = dbService.createImageLink({
      shortId,
      originalFileName,
      imageUrl,
      processedImageUrl,
      destinationUrl: urlCheck.url,
      description,
      framingMode,
      telegramUserId
    });

    const publicUrl = `${appUrl}/i/${link.shortId}`;

    return res.status(201).json({
      success: true,
      link,
      shortId: link.shortId,
      publicUrl,
      processedImageUrl
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to generate Image Link' });
  }
});

// --- Get Single ImageLink Details ---
apiRouter.get('/image-links/:shortId', (req: Request, res: Response) => {
  const { shortId } = req.params;
  const link = dbService.getLinkByShortId(shortId);

  if (!link) {
    return res.status(404).json({ error: 'Image Link not found or deleted.' });
  }

  const appUrl = getPublicAppUrl(req);
  return res.json({
    ...link,
    publicUrl: `${appUrl}/i/${link.shortId}`
  });
});

// --- Get Click Events / Analytics for a Link ---
apiRouter.get('/image-links/:id/events', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const link = dbService.getLinkById(id);
  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  const events = dbService.getLinkClickEvents(id, 50);
  return res.json({
    link,
    events
  });
});

// --- List Recent ImageLinks ---
apiRouter.get('/image-links', (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  let links = [];
  if (userId) {
    links = dbService.getUserLinks(userId, limit);
  } else {
    links = dbService.getAllLinks(limit, 0);
  }

  const appUrl = getPublicAppUrl(req);
  const enriched = links.map(l => ({
    ...l,
    publicUrl: `${appUrl}/i/${l.shortId}`
  }));

  const stats = userId ? dbService.getUserStats(userId) : dbService.getOverallStats();

  return res.json({
    links: enriched,
    stats
  });
});

// --- Admin / Owner Toggle Status ---
apiRouter.patch('/image-links/:id/status', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (status !== 'active' && status !== 'disabled') {
    return res.status(400).json({ error: "Status must be 'active' or 'disabled'" });
  }

  const success = dbService.updateLinkStatus(id, status);
  if (!success) {
    return res.status(404).json({ error: 'Link not found' });
  }

  return res.json({ success: true, status });
});

// --- Delete ImageLink ---
apiRouter.delete('/image-links/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const link = dbService.getLinkById(id);
  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  dbService.deleteLink(id);
  return res.json({ success: true, deleted: true });
});

// --- Developer Crawler Test Tool (Section 29) ---
apiRouter.get('/crawler-test', async (req: Request, res: Response) => {
  const target = req.query.url as string || req.query.shortId as string;
  if (!target) {
    return res.status(400).json({ error: 'Query parameter url or shortId is required.' });
  }

  let shortId = target;
  if (target.includes('/i/')) {
    shortId = target.split('/i/')[1].split('?')[0].split('/')[0];
  }

  const link = dbService.getLinkByShortId(shortId);
  if (!link) {
    return res.status(404).json({ error: `Image Link "${shortId}" not found in database.` });
  }

  const appUrl = getPublicAppUrl(req);
  const canonicalUrl = `${appUrl}/i/${link.shortId}`;

  // Extract domain for title
  let domain = 'Website';
  try {
    domain = new URL(link.destinationUrl).hostname;
  } catch {
    // fallback
  }

  const rawHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${link.description}</title>
  <meta name="description" content="${link.description}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${domain}">
  <meta property="og:description" content="${link.description}">
  <meta property="og:image" content="${link.processedImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${domain}">
  <meta name="twitter:description" content="${link.description}">
  <meta name="twitter:image" content="${link.processedImageUrl}">
</head>
<body>...</body>
</html>`;

  return res.json({
    status: 200,
    shortId: link.shortId,
    canonicalUrl,
    destinationUrl: link.destinationUrl,
    ogTitle: domain,
    ogDescription: link.description,
    ogImage: link.processedImageUrl,
    imageDimensions: { width: 1200, height: 630 },
    framingMode: link.framingMode,
    linkStatus: link.status,
    clickCount: link.clickCount,
    rawHtml
  });
});

// --- Automated Behavior Verification Tests (Section 35) ---
apiRouter.post('/run-tests', async (req: Request, res: Response) => {
  const appUrl = getPublicAppUrl(req);
  const results: Array<{ name: string; description: string; passed: boolean; details: string }> = [];

  const testShortId = 'tst_' + Math.random().toString(36).substring(2, 9);
  const targetDestination = 'https://example.com/target-landing-page';
  const testDesc = 'Automated Behavior Verification Test';

  const testLink = dbService.createImageLink({
    shortId: testShortId,
    originalFileName: 'test.jpg',
    imageUrl: `${appUrl}/api/images/test.jpg`,
    processedImageUrl: `${appUrl}/api/images/test_proc.jpg`,
    destinationUrl: targetDestination,
    description: testDesc,
    framingMode: 'crop_16_9'
  });

  const localBase = `http://127.0.0.1:${process.env.PORT || 3000}`;

  // TEST 1: Normal browser request -> Immediate HTTP 302 redirect
  try {
    const r1 = await fetch(`${localBase}/i/${testShortId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'manual'
    });
    const loc = r1.headers.get('location');
    const passed = (r1.status === 302 || r1.status === 307) && loc === targetDestination;
    results.push({
      name: 'TEST 1: Normal Browser Request',
      description: 'Immediate HTTP 302 redirect with Location header, zero delay, no HTML intermediary',
      passed,
      details: `HTTP Status: ${r1.status}, Location: ${loc || 'none'}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST 1: Normal Browser Request',
      description: 'Immediate HTTP 302 redirect',
      passed: false,
      details: err.message
    });
  }

  // TEST 2: Social crawler request -> HTTP 200 with OG & Twitter tags
  try {
    const r2 = await fetch(`${localBase}/i/${testShortId}`, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
      },
      redirect: 'manual'
    });
    const html = await r2.text();
    const hasOg = html.includes('og:title') && html.includes('og:description') && html.includes('og:image') && html.includes('og:url');
    const hasTw = html.includes('twitter:card') && html.includes('twitter:image');
    const passed = r2.status === 200 && hasOg && hasTw;
    results.push({
      name: 'TEST 2: Social Crawler Request',
      description: 'Server returns HTTP 200 with complete server-rendered Open Graph & Twitter Card metadata',
      passed,
      details: `HTTP Status: ${r2.status}, OG tags detected: ${hasOg ? 'Yes' : 'No'}, Twitter Card tags: ${hasTw ? 'Yes' : 'No'}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST 2: Social Crawler Request',
      description: 'Server returns HTTP 200 with OG metadata',
      passed: false,
      details: err.message
    });
  }

  // TEST 3: Disabled link -> HTTP 403, never redirect
  try {
    dbService.updateLinkStatus(testLink.id, 'disabled');
    const r3 = await fetch(`${localBase}/i/${testShortId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36' },
      redirect: 'manual'
    });
    const loc = r3.headers.get('location');
    const passed = r3.status === 403 && !loc;
    results.push({
      name: 'TEST 3: Disabled Link Handling',
      description: 'Disabled link blocks navigation with HTTP 403 and never redirects visitors',
      passed,
      details: `HTTP Status: ${r3.status}, Redirect blocked: ${!loc ? 'Yes' : 'Failed (redirected to ' + loc + ')'}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST 3: Disabled Link Handling',
      description: 'Disabled link blocks navigation',
      passed: false,
      details: err.message
    });
  }

  // TEST 4: Unknown link -> HTTP 404
  try {
    const r4 = await fetch(`${localBase}/i/unknown_${Date.now()}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36' },
      redirect: 'manual'
    });
    const passed = r4.status === 404;
    results.push({
      name: 'TEST 4: Nonexistent Link Handling',
      description: 'Unknown or nonexistent short IDs return HTTP 404 Not Found',
      passed,
      details: `HTTP Status: ${r4.status}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST 4: Nonexistent Link Handling',
      description: 'Unknown link handling',
      passed: false,
      details: err.message
    });
  }

  // TEST 5: Analytics database failure resilience
  try {
    dbService.updateLinkStatus(testLink.id, 'active');
    const originalRecordClick = dbService.recordClick.bind(dbService);
    dbService.recordClick = () => {
      throw new Error('Simulated Database Write Failure');
    };

    const r5 = await fetch(`${localBase}/i/${testShortId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36' },
      redirect: 'manual'
    });

    dbService.recordClick = originalRecordClick;
    const loc = r5.headers.get('location');
    const passed = (r5.status === 302 || r5.status === 307) && loc === targetDestination;
    results.push({
      name: 'TEST 5: Analytics Failure Resilience',
      description: 'Database analytics errors never block the visitor from being redirected immediately',
      passed,
      details: `HTTP Status: ${r5.status}, Redirect intact: ${passed ? 'Yes' : 'No'}`
    });
  } catch (err: any) {
    results.push({
      name: 'TEST 5: Analytics Failure Resilience',
      description: 'Analytics failure resilience',
      passed: false,
      details: err.message
    });
  }

  // Cleanup test record
  dbService.deleteLink(testLink.id);

  const allPassed = results.every(r => r.passed);
  return res.json({
    success: true,
    allPassed,
    total: results.length,
    passedCount: results.filter(r => r.passed).length,
    results
  });
});

// --- Admin Section ---
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.ADMIN_SECRET_KEY || 'admin12345';

function requireAdmin(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace('Bearer ', '') || req.query.admin_secret;
  if (!token || token !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid ADMIN_SECRET' });
  }
  next();
}

apiRouter.post('/admin/login', (req: Request, res: Response) => {
  const { secret } = req.body || {};
  if (secret === ADMIN_SECRET) {
    return res.json({ success: true, token: ADMIN_SECRET });
  }
  return res.status(401).json({ error: 'Invalid ADMIN_SECRET.' });
});

apiRouter.get('/admin/overview', requireAdmin, (req: Request, res: Response) => {
  const stats = dbService.getOverallStats();
  const links = dbService.getAllLinks(100, 0);
  const appUrl = getPublicAppUrl(req);

  const enrichedLinks = links.map(l => ({
    ...l,
    publicUrl: `${appUrl}/i/${l.shortId}`
  }));

  return res.json({
    stats,
    links: enrichedLinks
  });
});

// --- Telegram Webhook & Simulator ---
apiRouter.post('/telegram/webhook', async (req: Request, res: Response) => {
  try {
    const update = req.body;
    if (update && typeof update === 'object') {
      botService.handleUpdate(update).catch(err => console.error('Telegram update err:', err));
    }
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/telegram/simulate', async (req: Request, res: Response) => {
  try {
    const update = req.body;
    if (!update) return res.status(400).json({ error: 'Missing update payload' });

    const result = await botService.handleUpdate(update);
    const userId = String(update.message?.from?.id || update.message?.chat?.id || 'demo_user');
    const currentSession = dbService.getSession(userId);

    return res.json({
      success: true,
      result,
      session: currentSession
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/telegram/info', async (_req: Request, res: Response) => {
  try {
    const info = await botService.getBotInfo();
    return res.json(info);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/telegram/set-webhook', async (req: Request, res: Response) => {
  try {
    const { url } = req.body || {};
    const result = await botService.setWebhook(url);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
