import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { 
  getOgApngReference, 
  getApngMutableUrl, 
  apngNeedsUpdate 
} from '../../../../../../lib/ogApngService';
import { getProjectLatestTxId } from '../../../../../../lib/mutableSyncService';

// Use Node.js runtime for Puppeteer
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout

/**
 * Trigger APNG generation in background (fire-and-forget)
 */
function triggerApngGeneration(projectId: string) {
  const baseUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://getclayed.io';
  
  console.log('[Screenshot API] Triggering APNG generation for marketplace:', projectId);
  
  // Fire and forget - don't await
  fetch(`${baseUrl}/api/og/apng/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, type: 'marketplace' }),
  }).catch(err => {
    console.error('[Screenshot API] Failed to trigger APNG generation:', err);
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let browser = null;
  
  try {
    const { id } = await params;
    console.log('[Screenshot API] Request for marketplace item:', id);
    
    // Check if APNG exists and is up-to-date
    const latestTxId = await getProjectLatestTxId(id);
    if (latestTxId) {
      const apngRef = await getOgApngReference(id, 'marketplace');
      
      if (apngRef && !apngNeedsUpdate(apngRef, latestTxId)) {
        // APNG exists and is current - redirect to mutable URL
        const mutableUrl = getApngMutableUrl(apngRef.apngRootTxId);
        console.log('[Screenshot API] APNG found, redirecting to:', mutableUrl);
        
        return NextResponse.redirect(mutableUrl, {
          status: 302,
          headers: {
            'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600',
          },
        });
      } else {
        // APNG doesn't exist or outdated - trigger generation in background
        triggerApngGeneration(id);
        console.log('[Screenshot API] APNG not found or outdated, generating static image...');
      }
    }
    
    // Fall back to generating static PNG screenshot
    console.log('[Screenshot API] Rendering marketplace item:', id);
    
    // Launch browser with Chromium
    const isDev = process.env.NODE_ENV === 'development';
    
    browser = await puppeteer.launch({
      args: isDev ? [] : chromium.args,
      defaultViewport: {
        width: 1200,
        height: 800, // 3:2 aspect ratio for Farcaster
      },
      executablePath: isDev 
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' // Mac default
        : await chromium.executablePath(),
      headless: true,
    });
    
    console.log('[Screenshot API] Browser launched');
    
    const page = await browser.newPage();
    
    // Set viewport to OG image size (3:2 for Farcaster)
    await page.setViewport({
      width: 1200,
      height: 800,
      deviceScaleFactor: 1,
    });
    
    console.log('[Screenshot API] Viewport set');
    
    // Get base URL
    const baseUrl = isDev 
      ? 'http://localhost:3000' 
      : 'https://getclayed.io';
    
    // Navigate to the og-viewer page
    const viewerUrl = `${baseUrl}/og-viewer/marketplace/${id}`;
    console.log('[Screenshot API] Navigating to:', viewerUrl);
    
    await page.goto(viewerUrl, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });
    
    console.log('[Screenshot API] Page loaded');
    
    // Wait for Three.js to render
    await page.waitForSelector('canvas', { timeout: 30000 });
    console.log('[Screenshot API] Canvas found');
    
    // Wait for actual 3D content to render
    await page.waitForFunction(
      () => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return true;
        return canvas.width > 0 && canvas.height > 0;
      },
      { timeout: 10000 }
    );
    
    // Give extra time for 3D rendering to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('[Screenshot API] Render wait complete');
    
    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      encoding: 'binary',
    });
    
    console.log('[Screenshot API] Screenshot captured, size:', screenshot.length);
    
    await browser.close();
    browser = null;
    
    // Return as PNG image with minimal caching to ensure fresh images
    return new NextResponse(screenshot, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=3600',
        'CDN-Cache-Control': 'max-age=60',
        'Vercel-CDN-Cache-Control': 'max-age=60',
      },
    });
    
  } catch (error) {
    console.error('[Screenshot API] Error:', error);
    
    // Clean up browser if still open
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('[Screenshot API] Error closing browser:', closeError);
      }
    }
    
    // Return error response
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to generate screenshot',
        message: error instanceof Error ? error.message : 'Unknown error',
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
