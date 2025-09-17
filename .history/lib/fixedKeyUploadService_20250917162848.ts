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

  async upload(data: Buffer | Uint8Array | string, tags: Array<{ name: string; value: string }>) {
    if (!this.keypair) {
      throw new Error('Private key not initialized');
    }

    try {
      console.log('[FixedKeyUploader] Starting upload with fixed key...');
      console.log('[FixedKeyUploader] Data type:', typeof data);
      console.log('[FixedKeyUploader] Data size:', data instanceof Buffer ? data.length : data instanceof Uint8Array ? data.length : data.length);
      console.log('[FixedKeyUploader] Tags:', tags);
      
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
      const wallet = {
        publicKey: this.keypair.publicKey,
        secretKey: this.keypair.secretKey,
        signTransaction: async (tx: any) => {
          tx.partialSign(this.keypair!);
          return tx;
        },
        signAllTransactions: async (txs: any[]) => {
          return txs.map(tx => {
            tx.partialSign(this.keypair!);
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
          return nacl.sign.detached(messageBytes, this.keypair!.secretKey);
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
      console.log('[FixedKeyUploader] Creating uploader with wallet...');
      const uploader = WebUploader(WebSolana);
      const uploaderWithWallet = await uploader.withProvider(wallet);
      
      // Perform upload with timeout
      console.log('[FixedKeyUploader] Starting file upload...');
      const uploadPromise = uploaderWithWallet.uploadFile(dataFile, { tags });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Upload timeout after 30 seconds')), 30000)
      );
      
      const result = await Promise.race([uploadPromise, timeoutPromise]) as any;
      
      console.log('[FixedKeyUploader] Upload successful:', result.id);
      return {
        id: result.id,
        timestamp: result.timestamp || Date.now(),
        signature: result.signature || ''
      };
    } catch (error) {
      console.error('[FixedKeyUploader] Upload error:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const fixedKeyUploader = new FixedKeyUploader();
