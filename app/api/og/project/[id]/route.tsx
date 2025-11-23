import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

// Use Node.js runtime for Puppeteer
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let browser;
  try {
    const { id } = await params;
    
    // URL parameters
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || 'Untitled Project';
    const author = searchParams.get('author') || 'Unknown';
    
    console.log('[OG] Rendering 3D project:', id);
    
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport size to match OG image dimensions
    await page.setViewport({ width: 1200, height: 630 });
    
    // Navigate to a simple 3D viewer page (we'll need to create this)
    const viewerUrl = `${request.nextUrl.origin}/api/og-viewer/${id}`;
    console.log('[OG] Loading viewer:', viewerUrl);
    
    await page.goto(viewerUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // Wait for 3D scene to render
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      encoding: 'binary'
    });
    
    console.log('[OG] Screenshot captured');
    
    return new NextResponse(screenshot, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600'
      }
    });
    
  } catch (error) {
    console.error('[OG] Error rendering 3D:', error);
    
    // Fallback: generate a simple image with project name
    const { ImageResponse } = await import('@vercel/og');
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || 'Untitled Project';
    const author = searchParams.get('author') || 'Unknown';
    
    return new ImageResponse(
      (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#f9fafb',
          fontFamily: 'system-ui',
        }}>
          <div style={{
            fontSize: '48px',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '16px',
          }}>
            {name}
          </div>
          <div style={{
            fontSize: '20px',
            color: '#6b7280',
          }}>
            by {author.slice(0, 6)}...{author.slice(-4)}
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

