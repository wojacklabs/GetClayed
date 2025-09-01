import { WebUploader } from '@irys/web-upload';
import { WebEthereum } from '@irys/web-upload-ethereum';
import { EthersV6Adapter } from '@irys/web-upload-ethereum-ethers-v6';
import { ethers } from 'ethers';

// Cache for Irys uploader
let cachedUploader: any = null;
let cachedAddress: string | null = null;
let lastInitTime: number = 0;
const REINIT_INTERVAL = 30 * 60 * 1000; // 30 minutes

export async function createIrysUploader(provider?: any) {
  try {
    const now = Date.now();
    
    // Check if we can reuse cached uploader
    if (cachedUploader && provider && (now - lastInitTime) < REINIT_INTERVAL) {
      try {
        if (cachedUploader.address) {
          console.log('[createIrysUploader] Using cached uploader, address:', cachedUploader.address);
          return cachedUploader;
        }
      } catch (error) {
        console.log('[createIrysUploader] Cached uploader invalid, reinitializing...');
        cachedUploader = null;
      }
    }
    
    if (!provider) {
      // For read-only operations without wallet
      return await WebUploader(WebEthereum);
    }
    
    console.log('[createIrysUploader] Creating Irys uploader...');
    const initStart = Date.now();
    
    // Create ethers provider
    const ethersProvider = new ethers.BrowserProvider(provider);
    const signer = await ethersProvider.getSigner();
    const address = await signer.getAddress();
    
    // Check if we're reinitializing with the same address
    if (cachedAddress === address && cachedUploader) {
      console.log('[createIrysUploader] Same address, checking if existing uploader is still valid...');
      try {
        if (cachedUploader.address === address) {
          console.log('[createIrysUploader] Existing uploader is still valid, reusing it');
          lastInitTime = now;
          return cachedUploader;
        }
      } catch (error) {
        console.log('[createIrysUploader] Existing uploader validation failed, creating new one');
      }
    }
    
    // Create adapter
    const adapter = EthersV6Adapter(ethersProvider);
    
    // Create uploader with adapter
    const uploader = await WebUploader(WebEthereum).withAdapter(adapter);
    
    // Call ready() to complete initialization
    console.log('[createIrysUploader] Calling uploader.ready()...');
    const readyStart = Date.now();
    await uploader.ready();
    const readyEnd = Date.now();
    console.log(`[createIrysUploader] ready() completed in ${readyEnd - readyStart}ms`);
    
    console.log(`[createIrysUploader] Connected to Irys from ${uploader.address}`);
    console.log(`[createIrysUploader] Total initialization took ${Date.now() - initStart}ms`);
    
    // Cache the uploader
    cachedUploader = uploader;
    cachedAddress = address;
    lastInitTime = now;
    
    return uploader;
  } catch (error) {
    console.error('Error connecting to Irys:', error);
    cachedUploader = null;
    throw new Error('Error connecting to Irys');
  }
}

export async function uploadToIrys(
  irysUploader: any,
  data: Buffer | Uint8Array | File,
  tags?: Array<{ name: string; value: string }>
) {
  try {
    console.log('[uploadToIrys] Starting upload...');
    const uploadStartTime = Date.now();
    console.log('[uploadToIrys] Data type:', data.constructor.name);
    console.log('[uploadToIrys] Data size:', data instanceof File ? data.size : data.byteLength);
    
    let uploadData: any = data;
    
    // Convert Uint8Array to Buffer for compatibility
    if (data instanceof Uint8Array && !(data instanceof Buffer)) {
      uploadData = Buffer.from(data);
      console.log('[uploadToIrys] Converted Uint8Array to Buffer');
    }
    
    // Check data size
    const dataSize = uploadData instanceof File ? uploadData.size : uploadData.byteLength;
    const sizeInKB = dataSize / 1024;
    console.log(`[uploadToIrys] Data size: ${sizeInKB.toFixed(2)} KB`);
    
    // Only check price for data larger than 90KB
    if (sizeInKB >= 90) {
      console.log('[uploadToIrys] Data is over 90KB, checking price...');
      if (typeof irysUploader.getPrice === 'function') {
        try {
          const priceStart = Date.now();
          const price = await irysUploader.getPrice(dataSize);
          const priceEnd = Date.now();
          console.log(`[uploadToIrys] Price check took ${priceEnd - priceStart}ms, price:`, price);
          
          // Check if we have sufficient balance
          if (typeof irysUploader.getLoadedBalance === 'function') {
            const balance = await irysUploader.getLoadedBalance();
            console.log('[uploadToIrys] Current balance:', balance);
            if (balance.lt(price)) {
              throw new Error(`Insufficient balance. Required: ${price}, Available: ${balance}`);
            }
          }
        } catch (error) {
          console.error('[uploadToIrys] Price check failed:', error);
          throw error;
        }
      }
    } else {
      console.log('[uploadToIrys] Data is under 100KB - FREE upload!');
    }
    
    // Upload with tags
    console.log('[uploadToIrys] Calling upload method...');
    const uploadMethodStart = Date.now();
    const receipt = await irysUploader.upload(uploadData, { tags });
    const uploadMethodEnd = Date.now();
    
    console.log(`[uploadToIrys] Upload method took ${uploadMethodEnd - uploadMethodStart}ms`);
    console.log(`[uploadToIrys] Total upload took ${Date.now() - uploadStartTime}ms`);
    console.log('[uploadToIrys] Upload complete:', receipt.id);
    return receipt;
  } catch (error) {
    console.error('[uploadToIrys] Upload error:', error);
    throw error;
  }
}

export async function fundNode(irysUploader: any, amount: string) {
  try {
    const response = await irysUploader.fund(irysUploader.utils.toAtomic(amount));
    console.log(`Funded ${response.quantity} to Irys node`);
    return response;
  } catch (error) {
    console.error('Error funding node:', error);
    throw error;
  }
}

export async function getBalance(irysUploader: any) {
  try {
    const atomicBalance = await irysUploader.getLoadedBalance();
    const balance = irysUploader.utils.fromAtomic(atomicBalance);
    return balance;
  } catch (error) {
    console.error('Error getting balance:', error);
    throw error;
  }
}
