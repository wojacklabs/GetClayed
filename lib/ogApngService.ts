/**
 * OG APNG Service
 * Manages animated OG images for projects, libraries, and marketplace items
 * Uses Irys mutable pattern for versioned APNG storage
 */

import axios from 'axios';
import { fixedKeyUploader } from './fixedKeyUploadService';

// APNG Generation Config (matches logo generation spec)
export const OG_APNG_CONFIG = {
  FRAME_COUNT: 30,           // 30 frames
  CAPTURE_INTERVAL: 100,     // 100ms capture interval (10 FPS)
  FRAME_DELAY: 50,           // 50ms playback (20 FPS)
  WIDTH: 1200,               // OG image width
  HEIGHT: 800,               // OG image height (3:2 ratio for Farcaster)
};

export type OgApngType = 'project' | 'library' | 'marketplace';

export interface OgApngReference {
  projectId: string;
  apngRootTxId: string;      // gateway.irys.xyz/mutable/{this}
  latestApngTxId: string;    // Latest APNG transaction ID
  sourceTxId: string;        // Project version this APNG was generated from
  type: OgApngType;
  createdAt: number;
}

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

/**
 * Query GraphQL to find existing OG APNG for a project
 */
export async function getOgApngReference(
  projectId: string,
  type: OgApngType
): Promise<OgApngReference | null> {
  try {
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

    const response = await axios.post(IRYS_GRAPHQL_URL, { query });
    const edges = response.data?.data?.transactions?.edges || [];

    if (edges.length === 0) {
      return null;
    }

    // Find the root and latest transaction
    let rootTxId: string | null = null;
    let latestTxId: string | null = null;
    let sourceTxId: string | null = null;
    let latestTimestamp = 0;

    for (const edge of edges) {
      const tags = edge.node.tags.reduce((acc: any, tag: any) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});

      const txRootId = tags['Root-TX'];
      const txSourceId = tags['Source-TX'];

      if (txRootId) {
        // This is an update
        if (edge.node.timestamp > latestTimestamp) {
          rootTxId = txRootId;
          latestTxId = edge.node.id;
          sourceTxId = txSourceId;
          latestTimestamp = edge.node.timestamp;
        }
      } else {
        // This is the root (first upload)
        if (!rootTxId) {
          rootTxId = edge.node.id;
          latestTxId = edge.node.id;
          sourceTxId = txSourceId;
          latestTimestamp = edge.node.timestamp;
        }
      }
    }

    if (!rootTxId || !latestTxId) {
      return null;
    }

    return {
      projectId,
      apngRootTxId: rootTxId,
      latestApngTxId: latestTxId,
      sourceTxId: sourceTxId || '',
      type,
      createdAt: latestTimestamp,
    };
  } catch (error) {
    console.error('[OgApngService] Error querying APNG reference:', error);
    return null;
  }
}

/**
 * Upload APNG to Irys with mutable pattern
 */
export async function uploadOgApng(
  apngBuffer: Buffer,
  projectId: string,
  sourceTxId: string,
  type: OgApngType,
  existingRootTxId?: string
): Promise<{ txId: string; rootTxId: string }> {
  try {
    console.log('[OgApngService] Uploading OG APNG...');
    console.log('  - Project ID:', projectId);
    console.log('  - Source TX:', sourceTxId);
    console.log('  - Type:', type);
    console.log('  - Existing Root TX:', existingRootTxId || 'none (new)');

    const tags = [
      { name: 'App-Name', value: 'GetClayed' },
      { name: 'Data-Type', value: 'og-apng' },
      { name: 'Content-Type', value: 'image/apng' },
      { name: 'Project-ID', value: projectId },
      { name: 'OG-Type', value: type },
      { name: 'Source-TX', value: sourceTxId },
      { name: 'Created-At', value: Date.now().toString() },
    ];

    // Add Root-TX tag if updating existing APNG chain
    if (existingRootTxId) {
      tags.push({ name: 'Root-TX', value: existingRootTxId });
    }

    const receipt = await fixedKeyUploader.upload(apngBuffer, tags);
    
    // Root TX is either existing or this new transaction
    const rootTxId = existingRootTxId || receipt.id;

    console.log('[OgApngService] ✅ APNG uploaded successfully');
    console.log('  - TX ID:', receipt.id);
    console.log('  - Root TX:', rootTxId);
    console.log('  - Mutable URL:', `https://gateway.irys.xyz/mutable/${rootTxId}`);

    return {
      txId: receipt.id,
      rootTxId,
    };
  } catch (error) {
    console.error('[OgApngService] Error uploading APNG:', error);
    throw error;
  }
}

/**
 * Get the Irys mutable URL for an APNG
 */
export function getApngMutableUrl(apngRootTxId: string): string {
  return `https://gateway.irys.xyz/mutable/${apngRootTxId}`;
}

/**
 * Check if APNG needs to be regenerated
 * Returns true if sourceTxId doesn't match the current project version
 */
export function apngNeedsUpdate(
  apngRef: OgApngReference | null,
  currentProjectTxId: string
): boolean {
  if (!apngRef) {
    return true; // No APNG exists, need to generate
  }
  return apngRef.sourceTxId !== currentProjectTxId;
}

