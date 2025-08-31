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
    let receipt;
    
    // File 객체인 경우 uploadFile 메서드 사용
    if (data instanceof File) {
      receipt = await irysUploader.uploadFile(data, { tags });
    } else {
      // Buffer나 Uint8Array인 경우 upload 메서드 사용
      receipt = await irysUploader.upload(data, { tags });
    }
    
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
