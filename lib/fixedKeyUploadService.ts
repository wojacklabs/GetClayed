import { WebUploader } from '@irys/web-upload';
import { WebSolana } from '@irys/web-upload-solana';
import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';

// Fixed private key should be set in environment variable
// Format: comma-separated numbers like "123,456,789..."
const FIXED_PRIVATE_KEY = process.env.NEXT_PUBLIC_IRYS_PRIVATE_KEY;

export class FixedKeyUploader {
  private privateKey: Uint8Array | null = null;
  private keypair: Keypair | null = null;

  constructor() {
    if (FIXED_PRIVATE_KEY) {
      try {
        // Convert comma-separated string to Uint8Array
        const keyArray = FIXED_PRIVATE_KEY.split(',').map(num => parseInt(num.trim()));
        this.privateKey = new Uint8Array(keyArray);
        this.keypair = Keypair.fromSecretKey(this.privateKey);
        console.log('[FixedKeyUploader] Initialized with public key:', this.keypair.publicKey.toBase58());
      } catch (error) {
        console.error('[FixedKeyUploader] Failed to initialize private key:', error);
      }
    } else {
      console.warn('[FixedKeyUploader] No private key found in environment variables');
    }
  }

  async upload(data: Buffer | Uint8Array | string, tags: Array<{ name: string; value: string }>, maxRetries: number = 3) {
    if (!this.keypair) {
      throw new Error('Private key not initialized');
    }

    // FIX: Add retry logic for network failures
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[FixedKeyUploader] Upload attempt ${attempt}/${maxRetries}`);
        console.log('[FixedKeyUploader] Starting upload with fixed key...');
        console.log('[FixedKeyUploader] Data type:', typeof data);
        console.log('[FixedKeyUploader] Data size:', data instanceof Buffer ? data.length : data instanceof Uint8Array ? data.length : data.length);
        console.log('[FixedKeyUploader] Tags:', tags);
        
        return await this._performUpload(data, tags);
      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        
        // Check if it's a network-related error
        const isNetworkError = 
          errorMessage.includes('network') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('ETIMEDOUT') ||
          errorMessage.includes('fetch failed');
        
        if (!isNetworkError || attempt === maxRetries) {
          // Not a network error or last attempt - throw immediately
          console.error(`[FixedKeyUploader] Upload failed (attempt ${attempt}/${maxRetries}):`, error);
          throw error;
        }
        
        // Network error and not last attempt - retry with exponential backoff
        const waitTime = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.warn(`[FixedKeyUploader] Network error on attempt ${attempt}/${maxRetries}, retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw lastError;
  }

  private async _performUpload(data: Buffer | Uint8Array | string, tags: Array<{ name: string; value: string }>) {
    try {
      
      // Convert data to File
      let dataFile: File;
      if (typeof data === 'string') {
        const blob = new Blob([data], { type: 'application/json' });
        dataFile = new File([blob], 'data.json', { type: 'application/json' });
      } else {
        // Convert to ArrayBuffer for File
        if (data instanceof Uint8Array) {
          // Use the underlying ArrayBuffer with proper slice
          const arrayBuffer: ArrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
          const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
          dataFile = new File([blob], 'data.bin', { type: 'application/octet-stream' });
        } else {
          // For Buffer, convert to ArrayBuffer
          const bufferData = data as Buffer;
          const arrayBuffer: ArrayBuffer = bufferData.buffer.slice(bufferData.byteOffset, bufferData.byteOffset + bufferData.byteLength) as ArrayBuffer;
          const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
          dataFile = new File([blob], 'data.bin', { type: 'application/octet-stream' });
        }
      }

      // Create wallet object compatible with Irys (like CM's Note)
      if (!this.keypair) {
        throw new Error('Keypair not initialized');
      }
      
      const keypair = this.keypair; // Create const reference to avoid null issues
      
      const wallet = {
        publicKey: keypair.publicKey,
        secretKey: keypair.secretKey,
        signTransaction: async (tx: any) => {
          tx.partialSign(keypair);
          return tx;
        },
        signAllTransactions: async (txs: any[]) => {
          return txs.map(tx => {
            tx.partialSign(keypair);
            return tx;
          });
        },
        signMessage: async (message: Uint8Array | string | ArrayBuffer) => {
          let messageBytes: Uint8Array;
          if (message instanceof Uint8Array) {
            messageBytes = message;
          } else if (typeof message === 'string') {
            messageBytes = new TextEncoder().encode(message);
          } else if (message instanceof ArrayBuffer) {
            messageBytes = new Uint8Array(message);
          } else {
            messageBytes = new Uint8Array(Buffer.from(message));
          }
          return nacl.sign.detached(messageBytes, keypair.secretKey);
        },
        sign: async (data: any) => {
          if (data instanceof Uint8Array || typeof data === 'string' || data instanceof ArrayBuffer) {
            return wallet.signMessage(data);
          } else if (data.message) {
            return wallet.signMessage(data.message);
          } else {
            return wallet.signMessage(data);
          }
        },
        connected: true,
        payer: this.keypair.publicKey
      };

      // Create uploader with wallet
      console.log('[FixedKeyUploader] Step 1: Creating WebUploader instance...');
      const uploader = WebUploader(WebSolana);
      console.log('[FixedKeyUploader] Step 2: WebUploader instance created');
      
      console.log('[FixedKeyUploader] Step 3: Attaching wallet provider...');
      const uploaderWithWallet = await uploader.withProvider(wallet);
      console.log('[FixedKeyUploader] Step 4: Wallet provider attached successfully');
      
      // Perform upload
      console.log('[FixedKeyUploader] Step 5: Starting file upload...');
      console.log('[FixedKeyUploader] File size:', dataFile.size, 'bytes');
      console.log('[FixedKeyUploader] File type:', dataFile.type);
      
      const result = await uploaderWithWallet.uploadFile(dataFile, { tags });
      
      console.log('[FixedKeyUploader] Step 6: Upload completed successfully');
      console.log('[FixedKeyUploader] Transaction ID:', result.id);
      console.log('[FixedKeyUploader] Full result:', JSON.stringify(result));
      
      return {
        id: result.id,
        timestamp: result.timestamp || Date.now(),
        signature: result.signature || ''
      };
    } catch (error) {
      console.error('[FixedKeyUploader] _performUpload error:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const fixedKeyUploader = new FixedKeyUploader();
