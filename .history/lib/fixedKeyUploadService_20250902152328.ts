import { WebUploader } from '@irys/web-upload';
import { WebSolana } from '@irys/web-upload-solana';
import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';

// Fixed private key should be set in environment variable
// Format: comma-separated numbers like "123,456,789..."
// Read it inside the constructor to ensure it's loaded

export class FixedKeyUploader {
  private privateKey: Uint8Array | null = null;
  private keypair: Keypair | null = null;

  constructor() {
    console.log('[FixedKeyUploader] Checking for private key...');
    
    // Read environment variable inside constructor
    const FIXED_PRIVATE_KEY = process.env.NEXT_PUBLIC_IRYS_PRIVATE_KEY;
    
    console.log('[FixedKeyUploader] NEXT_PUBLIC_IRYS_PRIVATE_KEY exists:', !!FIXED_PRIVATE_KEY);
    console.log('[FixedKeyUploader] Key length:', FIXED_PRIVATE_KEY?.length || 0);
    
    if (FIXED_PRIVATE_KEY) {
      try {
        // Convert comma-separated string to Uint8Array
        const keyArray = FIXED_PRIVATE_KEY.split(',').map(num => parseInt(num.trim()));
        console.log('[FixedKeyUploader] Parsed key array length:', keyArray.length);
        
        this.privateKey = new Uint8Array(keyArray);
        this.keypair = Keypair.fromSecretKey(this.privateKey);
        console.log('[FixedKeyUploader] Successfully initialized with public key:', this.keypair.publicKey.toBase58());
      } catch (error) {
        console.error('[FixedKeyUploader] Failed to initialize private key:', error);
      }
    } else {
      console.warn('[FixedKeyUploader] No private key found in environment variables');
      console.warn('[FixedKeyUploader] Make sure NEXT_PUBLIC_IRYS_PRIVATE_KEY is set in .env.local');
    }
  }

  async upload(data: Buffer | Uint8Array | string, tags: Array<{ name: string; value: string }>) {
    console.log('[FixedKeyUploader] Upload called, keypair exists:', !!this.keypair);
    console.log('[FixedKeyUploader] Private key exists:', !!this.privateKey);
    
    if (!this.keypair) {
      console.error('[FixedKeyUploader] Keypair is null!');
      throw new Error('Private key not initialized - please check .env.local file');
    }

    try {
      console.log('[FixedKeyUploader] Starting upload with fixed key...');
      
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
      const uploader = WebUploader(WebSolana);
      const uploaderWithWallet = await uploader.withProvider(wallet);
      
      // Perform upload
      const result = await uploaderWithWallet.uploadFile(dataFile, { tags });
      
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

// Create singleton instance with lazy initialization
let _fixedKeyUploader: FixedKeyUploader | null = null;

export const getFixedKeyUploader = () => {
  if (!_fixedKeyUploader) {
    console.log('[FixedKeyUploader] Creating new instance...');
    _fixedKeyUploader = new FixedKeyUploader();
  }
  return _fixedKeyUploader;
};

// For backward compatibility
export const fixedKeyUploader = {
  upload: async (data: Buffer | Uint8Array | string, tags: Array<{ name: string; value: string }>) => {
    return getFixedKeyUploader().upload(data, tags);
  }
};
