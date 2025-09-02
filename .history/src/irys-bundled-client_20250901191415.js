import { WebUploader } from '@irys/web-upload';
import { WebEthereum } from '@irys/web-upload-ethereum';
import { EthersV6Adapter } from '@irys/web-upload-ethereum-ethers-v6';
import { ethers } from 'ethers';

export class IrysBundledClient {
  constructor() {
    this.uploader = null;
    this.wallet = null;
    this.privateKey = null;
  }

  // Set private key (called from Next.js with env variable)
  setPrivateKey(privateKey) {
    this.privateKey = privateKey;
  }

  // Initialize with private key
  async initialize() {
    try {
      if (!this.privateKey) {
        throw new Error('Private key not configured. Call setPrivateKey first.');
      }

      // Create wallet from private key
      this.wallet = new ethers.Wallet(this.privateKey);
      console.log('[IrysBundled] Initialized with address:', this.wallet.address);

      // Create Irys uploader
      const uploader = WebUploader(WebEthereum);
      this.uploader = await uploader.withProvider(new EthersV6Adapter(this.wallet));
      
      console.log('[IrysBundled] Uploader initialized');
      
      // Get and log balance
      const balance = await this.uploader.getLoadedBalance();
      console.log('[IrysBundled] Balance:', balance.toString());
      
      return true;
    } catch (error) {
      console.error('[IrysBundled] Initialization error:', error);
      return false;
    }
  }

  // Upload data to Irys
  async upload(data, tags = []) {
    try {
      if (!this.uploader) {
        throw new Error('Uploader not initialized');
      }

      console.log('[IrysBundled] Uploading data, size:', data.byteLength || data.length);
      console.log('[IrysBundled] Tags:', tags);

      // Convert data to Buffer if needed
      let uploadData = data;
      if (typeof data === 'string') {
        uploadData = Buffer.from(data, 'utf-8');
      } else if (data instanceof Uint8Array && !(data instanceof Buffer)) {
        uploadData = Buffer.from(data);
      }

      // Check if we need to fund
      const dataSize = uploadData.byteLength;
      const sizeInKB = dataSize / 1024;
      
      if (sizeInKB >= 90) {
        // Check price for large data
        const price = await this.uploader.getPrice(dataSize);
        const balance = await this.uploader.getLoadedBalance();
        
        console.log('[IrysBundled] Data size:', sizeInKB.toFixed(2), 'KB');
        console.log('[IrysBundled] Price:', price.toString());
        console.log('[IrysBundled] Balance:', balance.toString());
        
        if (balance.lt(price)) {
          throw new Error(`Insufficient balance. Required: ${price}, Available: ${balance}`);
        }
      } else {
        console.log('[IrysBundled] Data under 90KB - free upload');
      }

      // Upload to Irys
      const receipt = await this.uploader.upload(uploadData, { tags });
      
      console.log('[IrysBundled] Upload complete:', receipt.id);
      
      return {
        success: true,
        id: receipt.id,
        url: `https://gateway.irys.xyz/${receipt.id}`
      };
    } catch (error) {
      console.error('[IrysBundled] Upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Upload clay project
  async uploadClayProject(projectData, tags = []) {
    try {
      // Convert project data to JSON
      const jsonString = JSON.stringify(projectData);
      const dataBuffer = Buffer.from(jsonString, 'utf-8');
      
      // Add default tags
      const allTags = [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'App-Name', value: 'GetClayed' },
        { name: 'Data-Type', value: 'clay-project' },
        ...tags
      ];
      
      return await this.upload(dataBuffer, allTags);
    } catch (error) {
      console.error('[IrysBundled] Clay project upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Upload clay project chunk
  async uploadChunk(chunkData, metadata) {
    try {
      const tags = [
        { name: 'Data-Type', value: 'clay-project-chunk' },
        { name: 'Project-ID', value: metadata.projectId },
        { name: 'Project-Name', value: metadata.projectName },
        { name: 'Author', value: metadata.author },
        { name: 'Chunk-Set-ID', value: metadata.chunkSetId },
        { name: 'Chunk-Index', value: metadata.chunkIndex.toString() },
        { name: 'Total-Chunks', value: metadata.totalChunks.toString() },
        { name: 'Created-At', value: new Date().toISOString() }
      ];
      
      if (metadata.folder) {
        tags.push({ name: 'Folder', value: metadata.folder });
      }
      
      if (metadata.rootTxId) {
        tags.push({ name: 'Root-TX', value: metadata.rootTxId });
      }
      
      return await this.upload(chunkData, tags);
    } catch (error) {
      console.error('[IrysBundled] Chunk upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Upload chunk manifest
  async uploadManifest(manifestData, metadata) {
    try {
      const tags = [
        { name: 'Data-Type', value: 'clay-project-manifest' },
        { name: 'Project-ID', value: metadata.projectId },
        { name: 'Project-Name', value: metadata.projectName },
        { name: 'Author', value: metadata.author },
        { name: 'Chunk-Set-ID', value: metadata.chunkSetId },
        { name: 'Total-Chunks', value: metadata.totalChunks.toString() },
        { name: 'Created-At', value: new Date().toISOString() }
      ];
      
      if (metadata.folder) {
        tags.push({ name: 'Folder', value: metadata.folder });
      }
      
      if (metadata.rootTxId) {
        tags.push({ name: 'Root-TX', value: metadata.rootTxId });
      }
      
      const jsonString = JSON.stringify(manifestData);
      const dataBuffer = Buffer.from(jsonString, 'utf-8');
      
      return await this.upload(dataBuffer, tags);
    } catch (error) {
      console.error('[IrysBundled] Manifest upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get wallet address
  getAddress() {
    return this.wallet ? this.wallet.address : null;
  }

  // Get balance
  async getBalance() {
    try {
      if (!this.uploader) {
        throw new Error('Uploader not initialized');
      }
      
      const balance = await this.uploader.getLoadedBalance();
      return balance.toString();
    } catch (error) {
      console.error('[IrysBundled] Get balance error:', error);
      return '0';
    }
  }
}

// Export default instance
const irysBundledClient = new IrysBundledClient();

export default irysBundledClient;

// Also export for direct access
if (typeof window !== 'undefined') {
  window.IrysBundledClient = IrysBundledClient;
  window.irysBundledClient = irysBundledClient;
}
