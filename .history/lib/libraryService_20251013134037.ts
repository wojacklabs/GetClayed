import { ethers } from 'ethers';
import { fixedKeyUploader } from './fixedKeyUploadService';
import { uploadInChunks, uploadChunkManifest } from './chunkUploadService';
import { downloadClayProject, ClayProject } from './clayStorageService';

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

// Library contract address (to be deployed)
export const LIBRARY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS || '';

// USDC token address on Base Sepolia
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// Library contract ABI
export const LIBRARY_CONTRACT_ABI = [
  "function registerAsset(string projectId, string name, string description, uint256 priceETH, uint256 priceUSDC) external",
  "function purchaseAssetWithETH(string projectId) external payable",
  "function purchaseAssetWithUSDC(string projectId) external",
  "function getAsset(string projectId) external view returns (tuple(string projectId, string name, string description, uint256 priceETH, uint256 priceUSDC, address currentOwner, address originalCreator, uint256 totalRevenueETH, uint256 totalRevenueUSDC, uint256 purchaseCount, uint256 listedAt, bool isActive))",
  "function getUserAssets(address user) external view returns (string[])",
  "function getTotalAssets() external view returns (uint256)",
  "function getAssetIdByIndex(uint256 index) external view returns (string)",
  "function updateAssetPrice(string projectId, uint256 newPriceETH, uint256 newPriceUSDC) external"
];

// USDC ERC20 ABI (minimal)
export const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

export interface LibraryAsset {
  projectId: string;
  name: string;
  description: string;
  priceETH: string; // in ETH
  priceUSDC: string; // in USDC
  currentOwner: string;
  originalCreator: string;
  totalRevenueETH: string;
  totalRevenueUSDC: string;
  purchaseCount: number;
  listedAt: number;
  isActive: boolean;
  thumbnailId?: string;
  tags?: Record<string, string>;
}

/**
 * Register a project as a library asset
 */
export async function registerLibraryAsset(
  projectId: string,
  name: string,
  description: string,
  priceInIRYS: number,
  walletAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!LIBRARY_CONTRACT_ADDRESS) {
      throw new Error('Library contract not deployed');
    }
    
    // Get provider from window.ethereum
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No wallet provider found');
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    // Create contract instance
    const contract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      LIBRARY_CONTRACT_ABI,
      signer
    );
    
    // Convert price to wei
    const priceInWei = ethers.parseEther(priceInIRYS.toString());
    
    // Register asset on blockchain
    const tx = await contract.registerAsset(projectId, name, description, priceInWei);
    await tx.wait();
    
    // Also tag the project on Irys as a library asset
    const libraryMetadata = {
      projectId,
      name,
      description,
      price: priceInIRYS,
      registeredBy: walletAddress,
      registeredAt: Date.now()
    };
    
    const data = Buffer.from(JSON.stringify(libraryMetadata), 'utf-8');
    const tags = [
      { name: 'App-Name', value: 'GetClayed' },
      { name: 'Data-Type', value: 'library-registration' },
      { name: 'Project-ID', value: projectId },
      { name: 'Asset-Name', value: name },
      { name: 'Asset-Price', value: priceInIRYS.toString() },
      { name: 'Registered-By', value: walletAddress.toLowerCase() },
      { name: 'Registered-At', value: Date.now().toString() }
    ];
    
    await fixedKeyUploader.upload(data, tags);
    
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[LibraryService] Error registering asset:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Query all library assets from blockchain
 */
export async function queryLibraryAssets(
  limit: number = 100
): Promise<LibraryAsset[]> {
  try {
    // Query from Irys for library registrations
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["library-registration"] }
          ],
          first: ${limit},
          order: DESC
        ) {
          edges {
            node {
              id
              timestamp
              tags {
                name
                value
              }
            }
          }
        }
      }
    `;
    
    const response = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    const result = await response.json();
    const edges = result.data?.transactions?.edges || [];
    
    const assets: LibraryAsset[] = [];
    const seenProjects = new Set<string>();
    
    for (const edge of edges) {
      const tags = edge.node.tags.reduce((acc: any, tag: any) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      
      const projectId = tags['Project-ID'];
      
      // Skip duplicates (keep only the latest)
      if (seenProjects.has(projectId)) {
        continue;
      }
      seenProjects.add(projectId);
      
      // Get asset data from blockchain if contract is deployed
      let blockchainData: any = null;
      if (LIBRARY_CONTRACT_ADDRESS && typeof window !== 'undefined' && window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const contract = new ethers.Contract(
            LIBRARY_CONTRACT_ADDRESS,
            LIBRARY_CONTRACT_ABI,
            provider
          );
          blockchainData = await contract.getAsset(projectId);
        } catch (error) {
          console.warn('[LibraryService] Could not fetch blockchain data for', projectId);
        }
      }
      
      // Combine Irys metadata with blockchain data
      const asset: LibraryAsset = {
        projectId,
        name: tags['Asset-Name'] || 'Unnamed Asset',
        description: '',
        price: tags['Asset-Price'] || '0',
        currentOwner: tags['Registered-By'] || '',
        originalCreator: tags['Registered-By'] || '',
        totalRevenue: '0',
        purchaseCount: 0,
        listedAt: parseInt(tags['Registered-At'] || '0'),
        isActive: true,
        thumbnailId: tags['Thumbnail-ID'],
        tags
      };
      
      // Override with blockchain data if available
      if (blockchainData && blockchainData.isActive) {
        asset.price = ethers.formatEther(blockchainData.price);
        asset.currentOwner = blockchainData.currentOwner;
        asset.originalCreator = blockchainData.originalCreator;
        asset.totalRevenue = ethers.formatEther(blockchainData.totalRevenue);
        asset.purchaseCount = Number(blockchainData.purchaseCount);
        asset.isActive = blockchainData.isActive;
      }
      
      assets.push(asset);
    }
    
    return assets;
  } catch (error) {
    console.error('[LibraryService] Error querying library assets:', error);
    return [];
  }
}

/**
 * Purchase a library asset
 */
export async function purchaseLibraryAsset(
  projectId: string,
  priceInIRYS: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!LIBRARY_CONTRACT_ADDRESS) {
      throw new Error('Library contract not deployed');
    }
    
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No wallet provider found');
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    const contract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      LIBRARY_CONTRACT_ABI,
      signer
    );
    
    const priceInWei = ethers.parseEther(priceInIRYS.toString());
    
    const tx = await contract.purchaseAsset(projectId, { value: priceInWei });
    await tx.wait();
    
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[LibraryService] Error purchasing asset:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user's owned library assets
 */
export async function getUserLibraryAssets(
  walletAddress: string
): Promise<string[]> {
  try {
    if (!LIBRARY_CONTRACT_ADDRESS) {
      return [];
    }
    
    if (typeof window === 'undefined' || !window.ethereum) {
      return [];
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      LIBRARY_CONTRACT_ABI,
      provider
    );
    
    const assetIds = await contract.getUserAssets(walletAddress);
    return assetIds;
  } catch (error) {
    console.error('[LibraryService] Error getting user assets:', error);
    return [];
  }
}

