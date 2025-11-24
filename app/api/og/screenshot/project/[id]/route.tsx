import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Use Node.js runtime for Puppeteer
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout for chunked projects

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let browser = null;
  
  try {
    const { id } = await params;
    console.log('[Screenshot API] Rendering project:', id);
    
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
    const viewerUrl = `${baseUrl}/og-viewer/project/${id}`;
    console.log('[Screenshot API] Navigating to:', viewerUrl);
    
    await page.goto(viewerUrl, {
      waitUntil: 'networkidle0',
      timeout: 60000, // 60 seconds - increased for chunked projects
    });
    
    console.log('[Screenshot API] Page loaded, waiting for canvas...');
    
    // Wait for Three.js canvas to appear
    await page.waitForSelector('canvas', { timeout: 30000 });
    console.log('[Screenshot API] Canvas found');
    
    // Wait for actual 3D content to render (check canvas has content)
    await page.waitForFunction(
      () => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return false;
        // Check if canvas has been drawn to (has actual content)
        const ctx = canvas.getContext('2d');
        if (!ctx) return true; // WebGL canvas, assume ready
        return canvas.width > 0 && canvas.height > 0;
      },
      { timeout: 10000 }
    );
    console.log('[Screenshot API] Canvas ready');
    
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

