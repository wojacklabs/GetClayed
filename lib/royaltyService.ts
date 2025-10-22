import { ethers } from 'ethers';
import { USDC_ADDRESS, USDC_ABI, purchaseLibraryAssetWithETH, purchaseLibraryAssetWithUSDC } from './libraryService';

export const ROYALTY_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ROYALTY_CONTRACT_ADDRESS || '';

export const ROYALTY_CONTRACT_ABI = [
  "function registerProjectRoyalties(string projectId, string[] dependencyIds) external",
  "function validatePrice(string projectId, uint256 priceETH, uint256 priceUSDC) external view returns (bool)",
  "function getTotalRoyalties(string projectId) external view returns (uint256 totalETH, uint256 totalUSDC)",
  "function getProjectDependencies(string projectId) external view returns (tuple(string projectId, address creator, uint256 royaltyETH, uint256 royaltyUSDC)[])"
];

export interface LibraryDependency {
  projectId: string;
  name: string;
  royaltyPerImportETH: string;
  royaltyPerImportUSDC: string;
  creator?: string;
}

/**
 * Process library purchases and register royalties
 * @param projectId The project being uploaded
 * @param usedLibraries Array of libraries used in this project
 * @param paymentToken Payment token preference (ETH or USDC)
 * @returns Total cost including all library purchases
 */
export async function processLibraryPurchasesAndRoyalties(
  projectId: string,
  usedLibraries: LibraryDependency[],
  paymentToken: 'ETH' | 'USDC' = 'ETH',
  walletAddress?: string
): Promise<{ success: boolean; totalCost: number; alreadyOwned: number; error?: string }> {
  try {
    if (usedLibraries.length === 0) {
      return { success: true, totalCost: 0, alreadyOwned: 0 };
    }
    
    let totalCost = 0;
    let alreadyOwned = 0;
    
    // Check which libraries are already purchased
    const purchasedLibraries = new Set<string>();
    
    // Get user's owned library assets if wallet is available
    if (walletAddress && typeof window !== 'undefined' && window.ethereum) {
      try {
        const { getUserLibraryAssets } = await import('./libraryService');
        const ownedAssets = await getUserLibraryAssets(walletAddress);
        ownedAssets.forEach(id => purchasedLibraries.add(id));
      } catch (error) {
        console.warn('[RoyaltyService] Could not fetch owned assets');
      }
    }
    
    // Purchase each library asset (skip if already owned)
    for (const library of usedLibraries) {
      if (purchasedLibraries.has(library.projectId)) {
        console.log('[RoyaltyService] Skipping already owned library:', library.name);
        alreadyOwned++;
        continue;
      }
      
      const price = paymentToken === 'ETH' 
        ? parseFloat(library.royaltyPerImportETH) 
        : parseFloat(library.royaltyPerImportUSDC);
      
      if (price > 0) {
        let result;
        if (paymentToken === 'ETH') {
          result = await purchaseLibraryAssetWithETH(library.projectId, price);
        } else {
          result = await purchaseLibraryAssetWithUSDC(library.projectId, price);
        }
        
        if (!result.success) {
          throw new Error(`Failed to purchase ${library.name}: ${result.error}`);
        }
        
        totalCost += price;
      }
    }
    
    // Register royalties on blockchain
    if (ROYALTY_CONTRACT_ADDRESS && typeof window !== 'undefined' && window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const contract = new ethers.Contract(
        ROYALTY_CONTRACT_ADDRESS,
        ROYALTY_CONTRACT_ABI,
        signer
      );
      
    const dependencyIds = usedLibraries.map(lib => lib.projectId);
      
    const tx = await contract.registerProjectRoyalties(
      projectId,
      dependencyIds
    );
      await tx.wait();
      
      console.log('[RoyaltyService] Registered royalties for', usedLibraries.length, 'dependencies');
    }
    
    return { success: true, totalCost, alreadyOwned };
  } catch (error: any) {
    console.error('[RoyaltyService] Error processing libraries:', error);
    return { success: false, totalCost: 0, alreadyOwned: 0, error: error.message };
  }
}

/**
 * Calculate minimum price based on royalties
 */
export async function calculateMinimumPrice(
  usedLibraries: LibraryDependency[]
): Promise<{ minETH: number; minUSDC: number }> {
  if (usedLibraries.length === 0) {
    return { minETH: 0, minUSDC: 0 };
  }
  
  // Sum up direct royalty amounts
  const minETH = usedLibraries.reduce((sum, lib) => {
    return sum + parseFloat(lib.royaltyPerImportETH || '0');
  }, 0);
  
  const minUSDC = usedLibraries.reduce((sum, lib) => {
    return sum + parseFloat(lib.royaltyPerImportUSDC || '0');
  }, 0);
  
  return { minETH, minUSDC };
}

