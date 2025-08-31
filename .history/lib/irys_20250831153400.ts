import { WebUploader } from '@irys/web-upload';
import { WebBaseEth } from '@irys/web-upload-ethereum';
import { createIrysWallet } from './privy-irys-adapter';

export async function createIrysUploader(provider?: any) {
  try {
    if (!provider) {
      // For read-only operations without wallet
      return await WebUploader(WebBaseEth);
    }
    
    // Create an Irys-compatible wallet from Privy provider
    const irysWallet = await createIrysWallet(provider);
    
    // Create uploader with the adapted wallet
    const irysUploader = await WebUploader(WebBaseEth)
      .withProvider(irysWallet)
      .withRpc('https://testnet-rpc.irys.xyz/v1/execution-rpc');
    
    console.log(`[createIrysUploader] Connected to Irys from ${irysUploader.address}`);
    return irysUploader;
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
