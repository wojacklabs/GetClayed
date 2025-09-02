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
      
      // Convert data to Blob if needed
      let dataBlob: Blob;
      if (typeof data === 'string') {
        dataBlob = new Blob([data], { type: 'application/json' });
      } else {
        dataBlob = new Blob([data], { type: 'application/octet-stream' });
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
        payer: this.keypair.publicKey,
        publicKey: this.keypair.publicKey
      };

      // Create uploader with wallet
      const uploader = WebUploader(WebSolana);
      const uploaderWithWallet = await uploader.withProvider(wallet);
      
      // Perform upload
      const result = await uploaderWithWallet.uploadFile(dataBlob, { tags });
      
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
