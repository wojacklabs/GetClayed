import { NextRequest, NextResponse } from 'next/server';
import Irys from '@irys/upload';
import { EthereumEthersV6 } from '@irys/upload-ethereum';
import { ethers } from 'ethers';

// Get private key from environment
const PRIVATE_KEY = process.env.IRYS_PRIVATE_KEY || '';

// Initialize Irys client
let irysClient: Irys | null = null;

async function getIrysClient() {
  if (irysClient) return irysClient;
  
  if (!PRIVATE_KEY) {
    throw new Error('IRYS_PRIVATE_KEY not configured');
  }
  
  try {
    // Create wallet from private key
    const wallet = new ethers.Wallet(PRIVATE_KEY);
    
    // Create Irys client
    const getIrys = async () => {
      const irysUploader = await Irys.init({
        node: 'https://uploader.irys.xyz',
        token: 'ethereum',
        key: PRIVATE_KEY,
      });
      return irysUploader;
    };
    
    irysClient = await getIrys();
    
    console.log('[IrysAPI] Initialized with address:', wallet.address);
    
    // Get balance
    const balance = await irysClient.getLoadedBalance();
    console.log('[IrysAPI] Balance:', balance.toString());
    
    return irysClient;
  } catch (error) {
    console.error('[IrysAPI] Failed to initialize:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, tags, type = 'json' } = body;
    
    if (!data) {
      return NextResponse.json(
        { error: 'No data provided' },
        { status: 400 }
      );
    }
    
    // Get Irys client
    const client = await getIrysClient();
    
    // Prepare data
    let uploadData: Buffer;
    if (type === 'json') {
      uploadData = Buffer.from(JSON.stringify(data), 'utf-8');
    } else if (type === 'base64') {
      uploadData = Buffer.from(data, 'base64');
    } else {
      uploadData = Buffer.from(data, 'utf-8');
    }
    
    const sizeInKB = uploadData.byteLength / 1024;
    console.log(`[IrysAPI] Uploading ${sizeInKB.toFixed(2)} KB`);
    
    // Check if we need to fund (> 90KB)
    if (sizeInKB >= 90) {
      const price = await client.getPrice(uploadData.byteLength);
      const balance = await client.getLoadedBalance();
      
      console.log('[IrysAPI] Price:', price.toString());
      console.log('[IrysAPI] Balance:', balance.toString());
      
      if (balance.lt(price)) {
        return NextResponse.json(
          { error: `Insufficient balance. Required: ${price}, Available: ${balance}` },
          { status: 400 }
        );
      }
    } else {
      console.log('[IrysAPI] Data under 90KB - free upload');
    }
    
    // Upload to Irys
    const receipt = await client.upload(uploadData, { tags });
    
    console.log('[IrysAPI] Upload complete:', receipt.id);
    
    return NextResponse.json({
      success: true,
      id: receipt.id,
      url: `https://gateway.irys.xyz/${receipt.id}`,
      timestamp: receipt.timestamp
    });
    
  } catch (error: any) {
    console.error('[IrysAPI] Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    const client = await getIrysClient();
    const balance = await client.getLoadedBalance();
    
    return NextResponse.json({
      status: 'ok',
      address: client.address,
      balance: balance.toString()
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        status: 'error',
        error: error.message 
      },
      { status: 500 }
    );
  }
}
