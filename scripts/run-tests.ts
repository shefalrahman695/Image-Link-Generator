/**
 * Automated Verification Test Suite (Section 35)
 * Tests:
 * 1. Normal browser request -> Immediate HTTP 302 redirect (no delay, no HTML, Location header)
 * 2. Social crawler request -> HTTP 200 with complete server-rendered OG & Twitter Card metadata
 * 3. Disabled link -> HTTP 403 / disabled page, never redirects
 * 4. Unknown link -> HTTP 404 Image Link Not Found
 * 5. Analytics database failure -> Visitor is STILL redirected immediately
 */

import { dbService } from '../server/db.js';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Starting Automated Behavior Verification Tests...\n');
  let passed = 0;
  let total = 5;

  // Setup: Create a temporary test link
  const testShortId = 'tst_' + Math.random().toString(36).substring(2, 9);
  const targetDestination = 'https://example.com/target-landing-page';
  const testDesc = 'Exclusive Social Media Campaign Showcase';

  const testLink = dbService.createImageLink({
    shortId: testShortId,
    originalFileName: 'test.jpg',
    imageUrl: `${BASE_URL}/api/images/test.jpg`,
    processedImageUrl: `${BASE_URL}/api/images/test_proc.jpg`,
    destinationUrl: targetDestination,
    description: testDesc,
    framingMode: 'crop_16_9'
  });

  console.log(`Created test link: ${BASE_URL}/i/${testShortId}`);

  // --- TEST 1: Normal browser request ---
  try {
    const res = await fetch(`${BASE_URL}/i/${testShortId}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'manual'
    });

    const status = res.status;
    const location = res.headers.get('location');

    if ((status === 302 || status === 307) && location === targetDestination) {
      console.log('✅ TEST 1 PASSED: Normal browser request received immediate HTTP', status, 'redirect to', location);
      passed++;
    } else {
      console.error('❌ TEST 1 FAILED: Expected 302/307 with Location:', targetDestination, 'Got:', status, location);
    }
  } catch (err: any) {
    console.error('❌ TEST 1 ERROR:', err.message);
  }

  // --- TEST 2: Social crawler request ---
  try {
    const res = await fetch(`${BASE_URL}/i/${testShortId}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
      },
      redirect: 'manual'
    });

    const status = res.status;
    const html = await res.text();

    const hasOgTitle = html.includes('og:title');
    const hasOgDesc = html.includes('og:description');
    const hasOgImage = html.includes('og:image');
    const hasOgUrl = html.includes('og:url');
    const hasTwitterCard = html.includes('twitter:card');
    const hasTwitterImage = html.includes('twitter:image');

    if (status === 200 && hasOgTitle && hasOgDesc && hasOgImage && hasOgUrl && hasTwitterCard && hasTwitterImage) {
      console.log('✅ TEST 2 PASSED: Social crawler received HTTP 200 with complete server-rendered OG & Twitter metadata');
      passed++;
    } else {
      console.error('❌ TEST 2 FAILED: Missing OG tags or status not 200. Status:', status, {
        hasOgTitle,
        hasOgDesc,
        hasOgImage,
        hasOgUrl,
        hasTwitterCard,
        hasTwitterImage
      });
    }
  } catch (err: any) {
    console.error('❌ TEST 2 ERROR:', err.message);
  }

  // --- TEST 3: Disabled link ---
  try {
    // Disable the link
    dbService.updateLinkStatus(testLink.id, 'disabled');

    const res = await fetch(`${BASE_URL}/i/${testShortId}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'manual'
    });

    const status = res.status;
    const location = res.headers.get('location');

    if (status === 403 && !location) {
      console.log('✅ TEST 3 PASSED: Disabled link returned HTTP 403 and never redirected');
      passed++;
    } else {
      console.error('❌ TEST 3 FAILED: Disabled link must not redirect. Got status:', status, 'location:', location);
    }
  } catch (err: any) {
    console.error('❌ TEST 3 ERROR:', err.message);
  }

  // --- TEST 4: Unknown link ---
  try {
    const unknownShortId = 'nonexistent_' + Date.now();
    const res = await fetch(`${BASE_URL}/i/${unknownShortId}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'manual'
    });

    if (res.status === 404) {
      console.log('✅ TEST 4 PASSED: Unknown link returned HTTP 404 Not Found');
      passed++;
    } else {
      console.error('❌ TEST 4 FAILED: Expected HTTP 404 for unknown link, got:', res.status);
    }
  } catch (err: any) {
    console.error('❌ TEST 4 ERROR:', err.message);
  }

  // --- TEST 5: Analytics database failure resilience ---
  try {
    // Re-enable test link
    dbService.updateLinkStatus(testLink.id, 'active');

    // Monkey-patch dbService.recordClick to simulate an error
    const originalRecordClick = dbService.recordClick.bind(dbService);
    dbService.recordClick = () => {
      throw new Error('Simulated Database Disk Failure');
    };

    const res = await fetch(`${BASE_URL}/i/${testShortId}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      redirect: 'manual'
    });

    // Restore original method
    dbService.recordClick = originalRecordClick;

    const status = res.status;
    const location = res.headers.get('location');

    if ((status === 302 || status === 307) && location === targetDestination) {
      console.log('✅ TEST 5 PASSED: Visitor was still immediately redirected (HTTP', status, ') despite analytics error');
      passed++;
    } else {
      console.error('❌ TEST 5 FAILED: Analytics error blocked the redirect. Got:', status, location);
    }
  } catch (err: any) {
    console.error('❌ TEST 5 ERROR:', err.message);
  }

  // Cleanup test link
  dbService.deleteLink(testLink.id);

  console.log(`\n========================================`);
  console.log(`🏁 Test Summary: ${passed}/${total} passed (${((passed / total) * 100).toFixed(0)}%)`);
  console.log(`========================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
