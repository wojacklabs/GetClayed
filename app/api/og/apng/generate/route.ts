import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import UPNG from 'upng-js';
import { PNG } from 'pngjs';
import { 
  OG_APNG_CONFIG, 
  OgApngType,
  getOgApngReference,
  uploadOgApng,
  apngNeedsUpdate 
} from '../../../../../lib/ogApngService';

// Use Node.js runtime for Puppeteer
export const runtime = 'nodejs';
export const maxDuration = 120; // 120 seconds timeout for APNG generation

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

interface GenerateRequest {
  projectId: string;
  type: OgApngType;
  force?: boolean; // Force regeneration even if up-to-date
}

/**
 * Direct GraphQL query to get project's latest transaction ID
 * Handles both Project-ID (clay-xxx) and Transaction ID (base58 hash)
 */
async function getProjectLatestTxIdDirect(projectIdOrTxId: string): Promise<string | null> {
  try {
    console.log('[APNG Generate] Querying project directly:', projectIdOrTxId);
    
    // First, try searching by Project-ID tag
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["clay-project", "clay-project-manifest"] },
            { name: "Project-ID", values: ["${projectIdOrTxId}"] }
          ],
          first: 10,
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

    if (!response.ok) {
      console.error('[APNG Generate] GraphQL request failed:', response.status);
      return null;
    }

    const result = await response.json();
    let edges = result.data?.transactions?.edges || [];
    
    console.log('[APNG Generate] GraphQL result edges:', edges.length);
    
    // If no results and ID doesn't look like a Project-ID, it might be a Transaction ID
    if (edges.length === 0 && !projectIdOrTxId.startsWith('clay-')) {
      console.log('[APNG Generate] No Project-ID match, checking if it is a Transaction ID...');
      
      // Verify if the Transaction ID exists by fetching data directly
      const dataUrl = `https://uploader.irys.xyz/tx/${projectIdOrTxId}/data`;
      const dataResponse = await fetch(dataUrl, { method: 'HEAD' });
      
      if (dataResponse.ok) {
        console.log('[APNG Generate] Transaction ID is valid:', projectIdOrTxId);
        // The input IS the transaction ID
        return projectIdOrTxId;
      }
      
      return null;
    }

    // Find the latest transaction
    let latestTxId: string | null = null;
    let latestTimestamp = 0;

    for (const edge of edges) {
      if (edge.node.timestamp > latestTimestamp) {
        latestTxId = edge.node.id;
        latestTimestamp = edge.node.timestamp;
      }
    }

    return latestTxId;
  } catch (error) {
    console.error('[APNG Generate] Error querying project:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  let browser = null;
  
  try {
    const body: GenerateRequest = await request.json();
    const { projectId, type, force = false } = body;

    if (!projectId || !type) {
      return NextResponse.json(
        { error: 'Missing projectId or type' },
        { status: 400 }
      );
    }

    console.log('[APNG Generate] Starting generation...');
    console.log('  - Project ID:', projectId);
    console.log('  - Type:', type);
    console.log('  - Force:', force);

    // Get current project version using direct GraphQL query
    const latestTxId = await getProjectLatestTxIdDirect(projectId);
    
    if (!latestTxId) {
      return NextResponse.json(
        { 
          error: 'Project not found',
          projectId,
          hint: 'No transactions found for this Project-ID'
        },
        { status: 404 }
      );
    }
    console.log('[APNG Generate] Project latest TX:', latestTxId);

    // Check if APNG already exists and is up-to-date
    const existingApng = await getOgApngReference(projectId, type);
    
    if (!force && existingApng && !apngNeedsUpdate(existingApng, latestTxId)) {
      console.log('[APNG Generate] APNG already up-to-date, skipping');
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'APNG already up-to-date',
        apngRootTxId: existingApng.apngRootTxId,
        mutableUrl: `https://gateway.irys.xyz/mutable/${existingApng.apngRootTxId}`,
      });
    }

    // Launch browser
    const isDev = process.env.NODE_ENV === 'development';
    
    browser = await puppeteer.launch({
      args: isDev ? [] : chromium.args,
      defaultViewport: {
        width: OG_APNG_CONFIG.WIDTH,
        height: OG_APNG_CONFIG.HEIGHT,
      },
      executablePath: isDev 
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : await chromium.executablePath(),
      headless: true,
    });
    
    console.log('[APNG Generate] Browser launched');
    
    const page = await browser.newPage();
    await page.setViewport({
      width: OG_APNG_CONFIG.WIDTH,
      height: OG_APNG_CONFIG.HEIGHT,
      deviceScaleFactor: 1,
    });
    
    // Get base URL
    const baseUrl = isDev 
      ? 'http://localhost:3000' 
      : 'https://www.getclayed.io';
    
    // Navigate to og-viewer page
    const viewerUrl = `${baseUrl}/og-viewer/${type}/${projectId}`;
    console.log('[APNG Generate] Navigating to:', viewerUrl);
    
    await page.goto(viewerUrl, {
      waitUntil: 'networkidle2', // Allow up to 2 pending requests (chunks may still be loading)
      timeout: 90000, // Extended timeout for large chunked projects
    });
    
    console.log('[APNG Generate] Page loaded, waiting for canvas...');
    
    // Wait for Three.js canvas
    await page.waitForSelector('canvas', { timeout: 60000 });
    
    // Wait for 3D content to render
    await page.waitForFunction(
      () => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return false;
        return canvas.width > 0 && canvas.height > 0;
      },
      { timeout: 30000 }
    );
    
    // Extra time for initial render and chunk loading completion
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('[APNG Generate] Canvas ready, starting frame capture...');
    
    // Capture frames
    const frames: Uint8Array[] = [];
    let width = 0;
    let height = 0;
    
    for (let i = 0; i < OG_APNG_CONFIG.FRAME_COUNT; i++) {
      const screenshot = await page.screenshot({
        type: 'png',
        encoding: 'binary',
      }) as Buffer;
      
      // Parse PNG to get raw pixel data
      const png = PNG.sync.read(screenshot);
      
      if (width === 0) {
        width = png.width;
        height = png.height;
      }
      
      frames.push(new Uint8Array(png.data));
      
      console.log(`[APNG Generate] Frame ${i + 1}/${OG_APNG_CONFIG.FRAME_COUNT} captured`);
      
      // Wait for next frame (autoRotate will move the 3D scene)
      await new Promise(resolve => setTimeout(resolve, OG_APNG_CONFIG.CAPTURE_INTERVAL));
    }
    
    await browser.close();
    browser = null;
    
    console.log('[APNG Generate] All frames captured, encoding APNG...');
    
    // Create APNG
    const delays = new Array(frames.length).fill(OG_APNG_CONFIG.FRAME_DELAY);
    const apng = UPNG.encode(frames, width, height, 256, delays);
    const apngBuffer = Buffer.from(apng);
    
    console.log('[APNG Generate] APNG encoded, size:', (apngBuffer.length / 1024).toFixed(2), 'KB');
    
    // Upload to Irys
    const existingRootTxId = existingApng?.apngRootTxId;
    const { txId, rootTxId } = await uploadOgApng(
      apngBuffer,
      projectId,
      latestTxId,
      type,
      existingRootTxId
    );
    
    const mutableUrl = `https://gateway.irys.xyz/mutable/${rootTxId}`;
    
    console.log('[APNG Generate] ✅ Complete!');
    console.log('  - TX ID:', txId);
    console.log('  - Root TX:', rootTxId);
    console.log('  - Mutable URL:', mutableUrl);
    
    return NextResponse.json({
      success: true,
      txId,
      apngRootTxId: rootTxId,
      mutableUrl,
      frames: OG_APNG_CONFIG.FRAME_COUNT,
      size: apngBuffer.length,
    });
    
  } catch (error) {
    console.error('[APNG Generate] Error:', error);
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('[APNG Generate] Error closing browser:', closeError);
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to generate APNG',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

