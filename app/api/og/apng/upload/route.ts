import { NextRequest, NextResponse } from 'next/server';
import { uploadOgApng, getOgApngReference, OgApngType } from '../../../../../lib/ogApngService';

// Use Node.js runtime
export const runtime = 'nodejs';
export const maxDuration = 60;

interface UploadRequest {
  projectId: string;
  sourceTxId: string;
  type: OgApngType;
  apngBase64: string; // Base64 encoded APNG data
}

export async function POST(request: NextRequest) {
  try {
    const body: UploadRequest = await request.json();
    const { projectId, sourceTxId, type, apngBase64 } = body;

    if (!projectId || !sourceTxId || !type || !apngBase64) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, sourceTxId, type, apngBase64' },
        { status: 400 }
      );
    }

    console.log('[APNG Upload API] Uploading APNG...');
    console.log('  - Project ID:', projectId);
    console.log('  - Source TX:', sourceTxId);
    console.log('  - Type:', type);

    // Decode base64 to Buffer
    const apngBuffer = Buffer.from(apngBase64, 'base64');
    console.log('  - APNG size:', (apngBuffer.length / 1024).toFixed(2), 'KB');

    // Get existing APNG root TX for mutable updates
    const existingApng = await getOgApngReference(projectId, type);
    const existingRootTxId = existingApng?.apngRootTxId;

    if (existingRootTxId) {
      console.log('  - Existing Root TX:', existingRootTxId);
    }

    // Upload using fixedKeyUploader (uses Vercel's NEXT_PUBLIC_IRYS_PRIVATE_KEY)
    const { txId, rootTxId } = await uploadOgApng(
      apngBuffer,
      projectId,
      sourceTxId,
      type,
      existingRootTxId
    );

    const mutableUrl = `https://gateway.irys.xyz/mutable/${rootTxId}`;

    console.log('[APNG Upload API] ✅ Upload complete!');
    console.log('  - TX ID:', txId);
    console.log('  - Root TX:', rootTxId);
    console.log('  - Mutable URL:', mutableUrl);

    return NextResponse.json({
      success: true,
      txId,
      rootTxId,
      mutableUrl,
    });

  } catch (error) {
    console.error('[APNG Upload API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload APNG',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

