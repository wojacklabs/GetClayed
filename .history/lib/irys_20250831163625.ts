import { WebUploader } from '@irys/web-upload';
import { WebEthereum } from '@irys/web-upload-ethereum';
import { EthersV6Adapter } from '@irys/web-upload-ethereum-ethers-v6';
import { ethers } from 'ethers';

export async function createIrysUploader(provider?: any) {
  try {
    if (!provider) {
      // For read-only operations without wallet
      return await WebUploader(WebEthereum);
    }
    
    console.log('[createIrysUploader] Creating Irys uploader...');
    
    // Create ethers provider
    const ethersProvider = new ethers.BrowserProvider(provider);
    
    // Create adapter
    const adapter = EthersV6Adapter(ethersProvider);
    
    // Create uploader with adapter
    const uploader = await WebUploader(WebEthereum).withAdapter(adapter);
    
    // Call ready() to complete initialization
    console.log('[createIrysUploader] Calling uploader.ready()...');
    await uploader.ready();
    
    console.log(`[createIrysUploader] Connected to Irys from ${uploader.address}`);
    return uploader;
  } catch (error) {
    console.error('Error connecting to Irys:', error);
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
    console.log('[uploadToIrys] Data type:', data.constructor.name);
    console.log('[uploadToIrys] Data size:', data instanceof File ? data.size : data.byteLength);
    
    let uploadData: any = data;
    
    // Convert Uint8Array to Buffer for compatibility
    if (data instanceof Uint8Array && !(data instanceof Buffer)) {
      uploadData = Buffer.from(data);
      console.log('[uploadToIrys] Converted Uint8Array to Buffer');
    }
    
    // Upload with tags
    const receipt = await irysUploader.upload(uploadData, { tags });
    
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
