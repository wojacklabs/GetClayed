import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { 
  getOgApngReference, 
  apngNeedsUpdate,
  registerApngRequest
} from '../../../../../../lib/ogApngService';

// Use Node.js runtime for Puppeteer
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout for static PNG generation

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

/**
 * Direct GraphQL query to get project's latest transaction ID
 * Handles both Project-ID (clay-xxx) and Transaction ID (base58 hash)
 */
async function getProjectLatestTxIdDirect(projectIdOrTxId: string): Promise<string | null> {
  try {
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["clay-project", "clay-project-manifest"] },
            { name: "Project-ID", values: ["${projectIdOrTxId}"] }
          ],
          first: 5,
          order: DESC
        ) {
          edges {
            node {
              id
              timestamp
            }
          }
        }
      }
    `;

    const response = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) return null;

    const result = await response.json();
    const edges = result.data?.transactions?.edges || [];
    
    // If no results and ID doesn't look like a Project-ID, it might be a Transaction ID
    if (edges.length === 0 && !projectIdOrTxId.startsWith('clay-')) {
      // Verify if the Transaction ID exists
      const dataUrl = `https://uploader.irys.xyz/tx/${projectIdOrTxId}/data`;
      const dataResponse = await fetch(dataUrl, { method: 'HEAD' });
      if (dataResponse.ok) return projectIdOrTxId;
      return null;
    }
    
    if (edges.length === 0) return null;

    // Return the latest (first in DESC order)
    return edges[0].node.id;
  } catch (error) {
    console.error('[Screenshot API] Error querying project:', error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let browser = null;
  
  try {
    const { id } = await params;
    console.log('[Screenshot API] Request for project:', id);
    
    // Check if APNG exists and is up-to-date using direct GraphQL query
    const latestTxId = await getProjectLatestTxIdDirect(id);
    console.log('[Screenshot API] Latest TX ID:', latestTxId);
    
    if (latestTxId) {
      const apngRef = await getOgApngReference(id, 'project');
      
      if (apngRef && !apngNeedsUpdate(apngRef, latestTxId)) {
        // APNG exists and is current - fetch and return directly (no redirect)
        // Farcaster doesn't follow 302 redirects properly for OG images
        const apngUrl = `https://uploader.irys.xyz/tx/${apngRef.latestApngTxId}/data`;
        console.log('[Screenshot API] APNG found, fetching from:', apngUrl);
        
        try {
          const apngResponse = await fetch(apngUrl);
          if (apngResponse.ok) {
            const apngBuffer = await apngResponse.arrayBuffer();
            console.log('[Screenshot API] APNG fetched, size:', apngBuffer.byteLength);
            
            return new NextResponse(apngBuffer, {
              status: 200,
              headers: {
                'Content-Type': 'image/apng',
                'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600',
              },
            });
          }
        } catch (apngError) {
          console.error('[Screenshot API] Error fetching APNG:', apngError);
          // Fall through to generate static PNG
        }
      } else {
        // APNG doesn't exist or outdated - register request to Irys for external server processing
        console.log('[Screenshot API] APNG not found or outdated, registering request to Irys...');
        registerApngRequest(id, latestTxId, 'project').catch(err => {
          console.error('[Screenshot API] Failed to register APNG request:', err);
        });
      }
    } else {
      console.log('[Screenshot API] Could not get latestTxId, skipping APNG request');
    }
    
    // Fall back to generating static PNG screenshot
    console.log('[Screenshot API] Rendering project:', id);
    
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
      : 'https://www.getclayed.io';
    
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
