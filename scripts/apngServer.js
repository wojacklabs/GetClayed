#!/usr/bin/env node

/**
 * APNG Generation Server
 * 
 * This script runs separately from the main application to process APNG generation requests.
 * It polls Irys for pending requests and generates APNGs using Puppeteer.
 * 
 * Usage:
 *   node scripts/apngServer.js
 *   
 * Environment:
 *   - Requires Chrome/Chromium installed
 *   - Uses same Irys keys as main app (from .env)
 */

const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const UPNG = require('upng-js');
const { PNG } = require('pngjs');

// Load environment (try both .env and .env.local)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
const BASE_URL = 'https://www.getclayed.io';
const COMPLETED_FILE = path.join(__dirname, '..', 'data', 'apng-completed.json');

// APNG Config (matches main app)
const OG_APNG_CONFIG = {
  FRAME_COUNT: 30,
  CAPTURE_INTERVAL: 100,  // 100ms between captures
  FRAME_DELAY: 50,        // 50ms playback delay
  WIDTH: 1200,
  HEIGHT: 800,
};

// No local Solana key needed - upload is done via API using Vercel's key

/**
 * Load completed projects from file
 */
function loadCompleted() {
  try {
    if (fs.existsSync(COMPLETED_FILE)) {
      return JSON.parse(fs.readFileSync(COMPLETED_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading completed file:', error);
  }
  return {};
}

/**
 * Save completed project to file
 */
function saveCompleted(completed) {
  try {
    const dir = path.dirname(COMPLETED_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(COMPLETED_FILE, JSON.stringify(completed, null, 2));
  } catch (error) {
    console.error('Error saving completed file:', error);
  }
}

/**
 * Get all pending APNG requests from Irys
 */
async function getPendingRequests() {
  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["GetClayed"] },
          { name: "Data-Type", values: ["apng-request"] }
        ],
        order: ASC,
        limit: 100
      ) {
        edges {
          node {
            id
            timestamp
            tags {
              name
              value
            }
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(IRYS_GRAPHQL_URL, { query });
    const edges = response.data?.data?.transactions?.edges || [];
    
    return edges.map(edge => {
      const tags = edge.node.tags.reduce((acc, tag) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});

      return {
        txId: edge.node.id,
        projectId: tags['Project-ID'],
        sourceTxId: tags['Source-TX'],
        type: tags['OG-Type'],
        requestedAt: parseInt(tags['Requested-At'] || edge.node.timestamp),
      };
    });
  } catch (error) {
    console.error('Error getting pending requests:', error);
    return [];
  }
}

/**
 * Check if APNG already exists for a project
 */
async function hasApng(projectId, sourceTxId, type) {
  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["GetClayed"] },
          { name: "Data-Type", values: ["og-apng"] },
          { name: "Project-ID", values: ["${projectId}"] },
          { name: "Source-TX", values: ["${sourceTxId}"] },
          { name: "OG-Type", values: ["${type}"] }
        ],
        limit: 1
      ) {
        edges {
          node {
            id
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(IRYS_GRAPHQL_URL, { query });
    const edges = response.data?.data?.transactions?.edges || [];
    return edges.length > 0;
  } catch (error) {
    console.error('Error checking APNG existence:', error);
    return false;
  }
}

/**
 * Get existing APNG root TX for mutable updates
 */
async function getExistingApngRootTx(projectId, type) {
  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["GetClayed"] },
          { name: "Data-Type", values: ["og-apng"] },
          { name: "Project-ID", values: ["${projectId}"] },
          { name: "OG-Type", values: ["${type}"] }
        ],
        order: DESC,
        limit: 10
      ) {
        edges {
          node {
            id
            tags {
              name
              value
            }
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(IRYS_GRAPHQL_URL, { query });
    const edges = response.data?.data?.transactions?.edges || [];
    
    if (edges.length === 0) return null;

    // Find root TX
    for (const edge of edges) {
      const tags = edge.node.tags.reduce((acc, tag) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      
      if (tags['Root-TX']) {
        return tags['Root-TX'];
      }
    }

    // First APNG is the root
    return edges[edges.length - 1].node.id;
  } catch (error) {
    console.error('Error getting existing APNG:', error);
    return null;
  }
}

/**
 * Generate APNG using Puppeteer
 */
async function generateApng(projectId, type) {
  console.log(`📸 Generating APNG for ${type}/${projectId}...`);
  
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      width: OG_APNG_CONFIG.WIDTH,
      height: OG_APNG_CONFIG.HEIGHT,
    },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: OG_APNG_CONFIG.WIDTH,
      height: OG_APNG_CONFIG.HEIGHT,
      deviceScaleFactor: 1,
    });

    const viewerUrl = `${BASE_URL}/og-viewer/${type}/${projectId}`;
    console.log(`   Navigating to: ${viewerUrl}`);

    await page.goto(viewerUrl, {
      waitUntil: 'networkidle2',
      timeout: 120000, // 2 minutes for large projects
    });

    // Wait for canvas
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

    // Extra time for initial render
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(`   Canvas ready, capturing ${OG_APNG_CONFIG.FRAME_COUNT} frames...`);

    // Capture frames
    const frames = [];
    let width = 0;
    let height = 0;

    for (let i = 0; i < OG_APNG_CONFIG.FRAME_COUNT; i++) {
      const screenshot = await page.screenshot({
        type: 'png',
      });

      // Ensure it's a Buffer for pngjs
      const screenshotBuffer = Buffer.isBuffer(screenshot) ? screenshot : Buffer.from(screenshot);
      const png = PNG.sync.read(screenshotBuffer);
      
      if (width === 0) {
        width = png.width;
        height = png.height;
      }

      frames.push(new Uint8Array(png.data));
      
      if ((i + 1) % 10 === 0) {
        console.log(`   Frame ${i + 1}/${OG_APNG_CONFIG.FRAME_COUNT} captured`);
      }

      await new Promise(resolve => setTimeout(resolve, OG_APNG_CONFIG.CAPTURE_INTERVAL));
    }

    console.log('   All frames captured, encoding APNG...');

    // Create APNG
    const delays = new Array(frames.length).fill(OG_APNG_CONFIG.FRAME_DELAY);
    const apng = UPNG.encode(frames, width, height, 256, delays);
    const apngBuffer = Buffer.from(apng);

    console.log(`   APNG encoded: ${(apngBuffer.length / 1024).toFixed(2)} KB`);

    return apngBuffer;
  } finally {
    await browser.close();
  }
}

/**
 * Upload APNG via API (uses Vercel's environment key)
 */
async function uploadApng(apngBuffer, projectId, sourceTxId, type) {
  console.log(`📤 Uploading APNG via API...`);
  
  // Convert buffer to base64
  const apngBase64 = apngBuffer.toString('base64');
  console.log(`   Base64 size: ${(apngBase64.length / 1024).toFixed(2)} KB`);

  // Call API endpoint
  const response = await axios.post(`${BASE_URL}/api/og/apng/upload`, {
    projectId,
    sourceTxId,
    type,
    apngBase64,
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 120000, // 2 minutes
  });

  if (!response.data.success) {
    throw new Error(response.data.error || 'API upload failed');
  }

  console.log(`   ✅ Uploaded: ${response.data.txId}`);
  console.log(`   Root TX: ${response.data.rootTxId}`);
  console.log(`   Mutable URL: ${response.data.mutableUrl}`);

  return {
    txId: response.data.txId,
    rootTxId: response.data.rootTxId,
  };
}

/**
 * Process a single APNG request
 */
async function processRequest(request, completed) {
  const key = `${request.projectId}:${request.sourceTxId}:${request.type}`;
  
  // Skip if already completed
  if (completed[key]) {
    console.log(`⏭️  Skipping ${request.projectId} (already completed)`);
    return true;
  }

  // Check if APNG already exists on Irys
  const exists = await hasApng(request.projectId, request.sourceTxId, request.type);
  if (exists) {
    console.log(`⏭️  Skipping ${request.projectId} (APNG exists on Irys)`);
    completed[key] = {
      completedAt: Date.now(),
      skipped: true,
    };
    saveCompleted(completed);
    return true;
  }

  try {
    // Generate APNG
    const apngBuffer = await generateApng(request.projectId, request.type);

    // Upload via API (API handles existing root TX lookup)
    const { txId, rootTxId } = await uploadApng(
      apngBuffer,
      request.projectId,
      request.sourceTxId,
      request.type
    );

    // Mark as completed
    completed[key] = {
      completedAt: Date.now(),
      txId,
      rootTxId,
    };
    saveCompleted(completed);

    console.log(`✅ Completed: ${request.projectId}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed: ${request.projectId}`, error.message);
    return false;
  }
}

/**
 * Main processing loop
 */
async function main() {
  console.log('🚀 APNG Generation Server Started');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Completed file: ${COMPLETED_FILE}`);
  console.log('');

  const completed = loadCompleted();
  console.log(`📋 Loaded ${Object.keys(completed).length} completed entries`);

  // Get pending requests
  console.log('🔍 Fetching pending requests from Irys...');
  const requests = await getPendingRequests();
  console.log(`   Found ${requests.length} requests`);

  if (requests.length === 0) {
    console.log('✨ No pending requests. Exiting.');
    return;
  }

  // Filter out already completed
  const pending = requests.filter(req => {
    const key = `${req.projectId}:${req.sourceTxId}:${req.type}`;
    return !completed[key];
  });

  console.log(`📝 ${pending.length} requests to process`);
  console.log('');

  // Process each request sequentially
  for (let i = 0; i < pending.length; i++) {
    const request = pending[i];
    console.log(`\n[${i + 1}/${pending.length}] Processing ${request.type}/${request.projectId}`);
    console.log(`   Source TX: ${request.sourceTxId}`);
    console.log(`   Requested at: ${new Date(request.requestedAt).toISOString()}`);
    
    await processRequest(request, completed);
    
    // Small delay between requests
    if (i < pending.length - 1) {
      console.log('   Waiting 5 seconds before next request...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log('\n🎉 All requests processed!');
}

// Run
main().catch(console.error);

