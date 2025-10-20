import { ethers } from 'ethers';
import { fixedKeyUploader } from './fixedKeyUploadService';
import { uploadInChunks, uploadChunkManifest } from './chunkUploadService';
import { downloadClayProject, ClayProject } from './clayStorageService';

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

// Library contract address (to be deployed)
export const LIBRARY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS || '';

// USDC token address on Base Mainnet
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

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
async function getWalletProvider() {
  if (typeof window === 'undefined') {
    throw new Error('Window not available');
  }
  
  console.log('[LibraryService] Checking for wallet provider...');
  console.log('[LibraryService] window.ethereum exists:', !!(window as any).ethereum);
  
  // Check for injected wallet (MetaMask, etc) or Privy's embedded wallet
  const ethereum = (window as any).ethereum;
  
  if (!ethereum) {
    console.error('[LibraryService] No ethereum provider found in window');
    console.log('[LibraryService] Available providers:', Object.keys(window as any).filter(k => k.includes('wallet') || k.includes('ethereum')));
    throw new Error('No wallet connected. Please connect your wallet first using the Connect Wallet button.');
  }
  
  console.log('[LibraryService] Creating BrowserProvider...');
  const provider = new ethers.BrowserProvider(ethereum);
  
  console.log('[LibraryService] Getting signer...');
  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();
  
  console.log('[LibraryService] Signer address:', signerAddress);
  
  return { provider, signer };
}

export async function registerLibraryAsset(
  projectId: string,
  name: string,
  description: string,
  priceETH: number,
  priceUSDC: number,
  walletAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!LIBRARY_CONTRACT_ADDRESS) {
      throw new Error('Library contract not deployed');
    }
    
    const { signer } = await getWalletProvider();
    
    // Create contract instance
    const contract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      LIBRARY_CONTRACT_ABI,
      signer
    );
    
    // Convert prices
    const priceETHWei = ethers.parseEther(priceETH.toString());
    const priceUSDCUnits = ethers.parseUnits(priceUSDC.toString(), 6); // USDC has 6 decimals
    
    // Register asset on blockchain
    const tx = await contract.registerAsset(projectId, name, description, priceETHWei, priceUSDCUnits);
    await tx.wait();
    
    // Also tag the project on Irys as a library asset
    const libraryMetadata = {
      projectId,
      name,
      description,
      priceETH,
      priceUSDC,
      registeredBy: walletAddress,
      registeredAt: Date.now()
    };
    
    const data = Buffer.from(JSON.stringify(libraryMetadata), 'utf-8');
    const tags = [
      { name: 'App-Name', value: 'GetClayed' },
      { name: 'Data-Type', value: 'library-registration' },
      { name: 'Project-ID', value: projectId },
      { name: 'Asset-Name', value: name },
      { name: 'Asset-Price-ETH', value: priceETH.toString() },
      { name: 'Asset-Price-USDC', value: priceUSDC.toString() },
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
        priceETH: tags['Asset-Price-ETH'] || '0',
        priceUSDC: tags['Asset-Price-USDC'] || '0',
        currentOwner: tags['Registered-By'] || '',
        originalCreator: tags['Registered-By'] || '',
        totalRevenueETH: '0',
        totalRevenueUSDC: '0',
        purchaseCount: 0,
        listedAt: parseInt(tags['Registered-At'] || '0'),
        isActive: true,
        thumbnailId: tags['Thumbnail-ID'],
        tags
      };
      
      // Override with blockchain data if available
      if (blockchainData && blockchainData.isActive) {
        asset.priceETH = ethers.formatEther(blockchainData.priceETH);
        asset.priceUSDC = ethers.formatUnits(blockchainData.priceUSDC, 6);
        asset.currentOwner = blockchainData.currentOwner;
        asset.originalCreator = blockchainData.originalCreator;
        asset.totalRevenueETH = ethers.formatEther(blockchainData.totalRevenueETH);
        asset.totalRevenueUSDC = ethers.formatUnits(blockchainData.totalRevenueUSDC, 6);
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
 * Purchase a library asset with ETH
 */
export async function purchaseLibraryAssetWithETH(
  projectId: string,
  priceETH: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!LIBRARY_CONTRACT_ADDRESS) {
      throw new Error('Library contract not deployed');
    }
    
    const { signer } = await getWalletProvider();
    
    const contract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      LIBRARY_CONTRACT_ABI,
      signer
    );
    
    const priceInWei = ethers.parseEther(priceETH.toString());
    
    const tx = await contract.purchaseAssetWithETH(projectId, { value: priceInWei });
    await tx.wait();
    
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[LibraryService] Error purchasing asset with ETH:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Purchase a library asset with USDC
 */
export async function purchaseLibraryAssetWithUSDC(
  projectId: string,
  priceUSDC: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!LIBRARY_CONTRACT_ADDRESS) {
      throw new Error('Library contract not deployed');
    }
    
    const { signer } = await getWalletProvider();
    
    const contract = new ethers.Contract(
      LIBRARY_CONTRACT_ADDRESS,
      LIBRARY_CONTRACT_ABI,
      signer
    );
    
    const usdcContract = new ethers.Contract(
      USDC_ADDRESS,
      USDC_ABI,
      signer
    );
    
    const priceInUnits = ethers.parseUnits(priceUSDC.toString(), 6);
    
    // Check allowance
    const allowance = await usdcContract.allowance(await signer.getAddress(), LIBRARY_CONTRACT_ADDRESS);
    if (allowance < priceInUnits) {
      // Approve USDC spending
      const approveTx = await usdcContract.approve(LIBRARY_CONTRACT_ADDRESS, priceInUnits);
      await approveTx.wait();
    }
    
    const tx = await contract.purchaseAssetWithUSDC(projectId);
    await tx.wait();
    
    return { success: true, txHash: tx.hash };
  } catch (error: any) {
    console.error('[LibraryService] Error purchasing asset with USDC:', error);
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

