import { NextRequest, NextResponse } from 'next/server';
import Irys from '@irys/upload';
import EthereumAdapter from '@irys/upload-ethereum';

// Fixed private key from environment variable
const IRYS_PRIVATE_KEY = process.env.IRYS_PRIVATE_KEY;

if (!IRYS_PRIVATE_KEY) {
  console.error('[API] IRYS_PRIVATE_KEY not found in environment variables');
}

export async function POST(request: NextRequest) {
  try {
    console.log('[API] Fixed key upload request received');
    
    if (!IRYS_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error: missing private key' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { data, tags, isChunk } = body;

    if (!data || !tags) {
      return NextResponse.json(
        { error: 'Missing required fields: data and tags' },
        { status: 400 }
      );
    }

    console.log('[API] Upload request:', {
      dataSize: Buffer.from(data).length,
      tagsCount: tags.length,
      isChunk
    });

    // Initialize Irys with fixed private key
    const irys = new Irys({
      url: 'https://uploader.irys.xyz',
      token: 'ethereum',
      key: IRYS_PRIVATE_KEY,
      config: {
        adapter: EthereumAdapter,
      }
    });

    console.log('[API] Irys client initialized');

    // Convert data to Buffer
    const dataBuffer = Buffer.from(data);
    const dataSizeKB = dataBuffer.length / 1024;
    console.log(`[API] Data size: ${dataSizeKB.toFixed(2)} KB`);

    // Check if upload would be free (under 90KB)
    if (dataSizeKB >= 90 && !isChunk) {
      console.log('[API] Data exceeds 90KB free tier');
      const price = await irys.getPrice(dataBuffer.length);
      console.log(`[API] Upload would cost: ${irys.utils.formatUnits(price)} ETH`);
      
      return NextResponse.json(
        { 
          error: 'Data exceeds free tier. Use chunked upload or fund the uploader wallet.',
          size: dataSizeKB,
          estimatedCost: irys.utils.formatUnits(price)
        },
        { status: 400 }
      );
    }

    // Upload to Irys
    try {
      console.log('[API] Starting upload to Irys...');
      const receipt = await irys.upload(dataBuffer, { tags });
      
      console.log('[API] Upload successful:', {
        id: receipt.id,
        timestamp: receipt.timestamp,
        signature: receipt.signature.substring(0, 20) + '...'
      });

      return NextResponse.json({
        success: true,
        id: receipt.id,
        timestamp: receipt.timestamp,
        signature: receipt.signature
      });
    } catch (uploadError: any) {
      console.error('[API] Upload error:', uploadError);
      
      // Check if it's a funding error
      if (uploadError.message?.includes('balance') || uploadError.message?.includes('fund')) {
        const balance = await irys.getLoadedBalance();
        console.log('[API] Current balance:', irys.utils.formatUnits(balance));
        
        return NextResponse.json(
          { 
            error: 'Insufficient balance in uploader wallet',
            currentBalance: irys.utils.formatUnits(balance),
            message: uploadError.message
          },
          { status: 402 }
        );
      }
      
      throw uploadError;
    }
  } catch (error: any) {
    console.error('[API] Error in fixed key upload:', error);
    return NextResponse.json(
      { 
        error: 'Upload failed',
        message: error.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
