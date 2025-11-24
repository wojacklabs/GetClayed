import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
// @ts-ignore - upng-js doesn't have types
import UPNG from 'upng-js';
import { PNG } from 'pngjs';

// Use Node.js runtime for Puppeteer
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout for APNG generation

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let browser = null;
  
  try {
    const { id } = await params;
    console.log('[Screenshot API] Rendering library asset:', id);
    
    // Launch browser with Chromium
    const isDev = process.env.NODE_ENV === 'development';
    
    browser = await puppeteer.launch({
      args: isDev ? [] : chromium.args,
      defaultViewport: {
        width: 1200,
        height: 630,
      },
      executablePath: isDev 
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' // Mac default
        : await chromium.executablePath(),
      headless: true,
    });
    
    console.log('[Screenshot API] Browser launched');
    
    const page = await browser.newPage();
    
    // Set viewport to OG image size
    await page.setViewport({
      width: 1200,
      height: 630,
      deviceScaleFactor: 1,
    });
    
    console.log('[Screenshot API] Viewport set');
    
    // Get base URL
    const baseUrl = isDev 
      ? 'http://localhost:3000' 
      : 'https://getclayed.io';
    
    // Navigate to the og-viewer page
    const viewerUrl = `${baseUrl}/og-viewer/library/${id}`;
    console.log('[Screenshot API] Navigating to:', viewerUrl);
    
    await page.goto(viewerUrl, {
      waitUntil: 'networkidle0',
      timeout: 60000, // 60 seconds - increased for chunked projects
    });
    
    console.log('[Screenshot API] Page loaded');
    
    // Wait for the animationReady signal from the client-side
    await page.waitForFunction('window.animationReady === true', { timeout: 20000 });
    console.log('[Screenshot API] Animation ready signal received');
    
    // Give extra time for 3D rendering to complete
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second wait after signal
    console.log('[Screenshot API] Initial render complete');
    
    // Capture multiple frames for APNG animation (30 frames for smooth rotation)
    const frames: Buffer[] = [];
    const numFrames = 30;
    const frameDelay = 50; // 50ms = 20 FPS (same as home screen)
    
    console.log('[Screenshot API] Capturing', numFrames, 'frames...');
    
    for (let i = 0; i < numFrames; i++) {
      await new Promise(resolve => setTimeout(resolve, frameDelay));
      
      // Capture screenshot of the canvas element only
      const canvas = await page.$('canvas');
      if (!canvas) {
        throw new Error('Canvas element not found for screenshot.');
      }
      const screenshot = await canvas.screenshot({
        type: 'png',
        encoding: 'binary',
        omitBackground: true, // Transparent background
      });
      frames.push(screenshot as Buffer);
      if (i % 10 === 0) {
        console.log(`[Screenshot API] Captured frame ${i + 1}/${numFrames}`);
      }
    }
    
    console.log('[Screenshot API] All frames captured, encoding APNG...');
    
    // Convert frames to UPNG format
    const pngFrames: Uint8Array[] = [];
    let width = 0;
    let height = 0;
    
    for (const frame of frames) {
      const png = PNG.sync.read(frame);
      if (width === 0) {
        width = png.width;
        height = png.height;
      }
      pngFrames.push(png.data as Uint8Array);
    }
    
    // Create APNG with looping (256 = full RGBA color, same as home screen)
    const delays = new Array(numFrames).fill(frameDelay);
    const apng = UPNG.encode(pngFrames as any, width, height, 256, delays);
    
    console.log('[Screenshot API] APNG encoded, size:', apng.byteLength);
    
    await browser.close();
    browser = null;
    
    // Return as APNG
    return new NextResponse(Buffer.from(apng), {
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

