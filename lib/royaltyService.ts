import { ethers } from 'ethers';
import { USDC_ADDRESS, USDC_ABI, purchaseLibraryAssetWithETH, purchaseLibraryAssetWithUSDC } from './libraryService';
import { fixedKeyUploader } from './fixedKeyUploadService';
import { formatETH, formatUSDC } from './formatCurrency';

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

export interface RoyaltyReceipt {
  projectId: string;
  projectName: string;
  payer: string;
  libraries: Array<{
    projectId: string;
    name: string;
    owner: string; // Owner at time of payment
    royaltyETH: string;
    royaltyUSDC: string;
    // Version tracking for abuse prevention
    importedTxId?: string;  // Transaction ID at import time
    importedAt?: number;    // Timestamp when imported
    distributions?: Array<{
      projectId: string;
      name: string;
      owner: string;
      amountETH: string;
      amountUSDC: string;
    }>;
    profitETH?: string;
    profitUSDC?: string;
  }>;
  totalPaidETH: string;
  totalPaidUSDC: string;
  timestamp: number;
  txHashes: {
    register?: string;
    paymentETH?: string;
    approveUSDC?: string;
    paymentUSDC?: string;
  };
}

/**
 * Process library purchases and register royalties
 * @param projectId The project being uploaded
 * @param usedLibraries Array of libraries used in this project (should be direct imports only for hierarchical royalties)
 * @param allDependencies Optional array of all dependencies (direct + indirect) for registration
 * @param paymentToken Payment token preference (ETH or USDC)
 * @returns Total cost including all library purchases
 */
export async function processLibraryPurchasesAndRoyalties(
  projectId: string,
  usedLibraries: LibraryDependency[],
  customProvider?: any,
  onProgress?: (message: string) => void,
  allDependencies?: LibraryDependency[]
): Promise<{ 
  success: boolean; 
  totalCostETH: number; 
  totalCostUSDC: number; 
  alreadyOwned: number; 
  error?: string;
  txHashes?: any;
  librariesWithOwners?: any[];
}> {
  try {
    if (usedLibraries.length === 0) {
      return { success: true, totalCostETH: 0, totalCostUSDC: 0, alreadyOwned: 0 };
    }
    
    // SECURITY FIX: Check current blockchain state to filter deleted/disabled libraries
    // This ensures we don't send excess ETH/USDC that would get stuck in contract
    const { getLibraryCurrentRoyalties } = await import('./libraryService');
    const projectIds = usedLibraries.map(lib => lib.projectId);
    const currentStates = await getLibraryCurrentRoyalties(projectIds, customProvider);
    
    // Filter to only active libraries first
    const activeLibraries = usedLibraries.filter(lib => {
      const state = currentStates.get(lib.projectId);
      return state && state.exists && state.enabled;
    });
    
    console.log('[RoyaltyService] Total libraries:', usedLibraries.length);
    console.log('[RoyaltyService] Active libraries:', activeLibraries.length);
    console.log('[RoyaltyService] Filtered out:', usedLibraries.length - activeLibraries.length);
    
    // Calculate total royalties (both ETH and USDC) - using stored values
    // Note: Contract will use current values from getRoyaltyFee
    let totalRoyaltyETH = 0;
    let totalRoyaltyUSDC = 0;
    
    for (const library of activeLibraries) {
      const state = currentStates.get(library.projectId);
      if (state) {
        // Use current blockchain values
        totalRoyaltyETH += state.ethAmount;
        totalRoyaltyUSDC += state.usdcAmount;
      }
    }
    
    // CRITICAL FIX: Pre-validate USDC balance BEFORE any contract calls
    if (totalRoyaltyUSDC > 0 && customProvider) {
      // Check USDC balance early to fail fast
      const { ethers } = await import('ethers');
      const provider = new ethers.BrowserProvider(customProvider);
      const signer = await provider.getSigner();
      const usdcContract = new ethers.Contract(
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC_ADDRESS
        ['function balanceOf(address) external view returns (uint256)'],
        signer
      );
      
      const userAddress = await signer.getAddress();
      const usdcBalance = await usdcContract.balanceOf(userAddress);
      const royaltyUnits = ethers.parseUnits(totalRoyaltyUSDC.toFixed(6), 6);
      
      if (usdcBalance < royaltyUnits) {
        const balanceFormatted = ethers.formatUnits(usdcBalance, 6);
        const requiredFormatted = totalRoyaltyUSDC.toFixed(6);
        throw new Error(
          `Insufficient USDC balance.\n` +
          `Required: ${requiredFormatted} USDC\n` +
          `Available: ${balanceFormatted} USDC\n` +
          `Please add ${formatUSDC(totalRoyaltyUSDC - parseFloat(balanceFormatted))} USDC to your wallet before saving.`
        );
      }
    }
    
    console.log('[RoyaltyService] Active libraries:');
    activeLibraries.forEach((lib, idx) => {
      const state = currentStates.get(lib.projectId);
      console.log(`  ${idx + 1}. ${lib.name}: ${state?.ethAmount} ETH, ${state?.usdcAmount} USDC`);
    });
    console.log('[RoyaltyService] Total royalties (current blockchain values) - ETH:', totalRoyaltyETH, 'USDC:', totalRoyaltyUSDC);
    
    // Check if royalty contract is deployed
    if (!ROYALTY_CONTRACT_ADDRESS) {
      console.error('[RoyaltyService] ❌ ROYALTY_CONTRACT_ADDRESS not configured!');
      throw new Error('Royalty contract not deployed. Cannot process library royalties.');
    }
    
    // Calculate total number of transactions needed
    const totalTransactions = 1 + (totalRoyaltyETH > 0 ? 1 : 0) + (totalRoyaltyUSDC > 0 ? 2 : 0);
    let currentTransaction = 0;
    
    // Pay royalties via ClayRoyalty contract
    {
      let provider, signer;
      if (customProvider) {
        provider = new ethers.BrowserProvider(customProvider);
        signer = await provider.getSigner();
      } else {
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
      }
      
      const contract = new ethers.Contract(
        ROYALTY_CONTRACT_ADDRESS,
        [
          'function recordRoyalties(string projectId, uint256 price, uint8 paymentToken) external payable',
          'function registerProjectRoyalties(string projectId, string[] dependencyIds, string[] directDependencyIds) external',
          'function getProjectDependencies(string projectId) external view returns (tuple(string dependencyProjectId, uint256 royaltyPercentage, uint256 fixedRoyaltyETH, uint256 fixedRoyaltyUSDC, bool isDirect)[])',
          'event RoyaltyRecorded(string indexed projectId, address indexed recipient, uint256 amountETH, uint256 amountUSDC)'
        ],
        signer
      );
      
      // STEP 1: Register dependencies first (required before paying royalties)
      // SECURITY FIX: Only register ACTIVE libraries (not deleted/disabled)
      // CRITICAL FIX: Check if already registered AND if royalties were paid
      
      let needsRegistration = true;
      let needsRoyaltyPayment = true;
      
      // Check if project already has registered royalties
      try {
        const existingDeps = await contract.getProjectDependencies(projectId);
        
        if (existingDeps && existingDeps.length > 0) {
          // Project has royalties registered
          console.log('[RoyaltyService] ⚠️ Project already has registered royalties');
          console.log('[RoyaltyService] Existing dependencies:', existingDeps.length);
          needsRegistration = false;
          
          // CRITICAL FIX: Check if royalties were actually PAID
          // This handles partial failure case: registerProjectRoyalties succeeded but recordRoyalties failed
          try {
            const filter = contract.filters.RoyaltyRecorded(projectId);
            const events = await contract.queryFilter(filter, -100000); // Last ~100k blocks
            
            if (events.length > 0) {
              console.log('[RoyaltyService] ✅ Royalties already paid for this project (found', events.length, 'payment events)');
              console.log('[RoyaltyService] This is a project UPDATE - no payment needed');
              needsRoyaltyPayment = false;
            } else {
              console.log('[RoyaltyService] ⚠️ Registered but NO payment events found!');
              console.log('[RoyaltyService] This might be a PARTIAL FAILURE recovery - will retry payment');
              needsRoyaltyPayment = true;
            }
          } catch (eventError) {
            console.warn('[RoyaltyService] Could not query payment events, assuming payment needed');
            needsRoyaltyPayment = true;
          }
        }
      } catch (error: any) {
        // Project not registered yet (this will throw)
        console.log('[RoyaltyService] Project not yet registered, will register dependencies');
        needsRegistration = true;
        needsRoyaltyPayment = true;
      }
      
      const txHashes: any = {};
      
      // STEP 1A: Register dependencies (if needed)
      if (needsRegistration && activeLibraries.length > 0) {
        currentTransaction++;
        
        // For hierarchical royalties: separate all dependencies and direct dependencies
        const allDeps = allDependencies || usedLibraries; // Use all if provided, otherwise assume usedLibraries are all deps
        const allActiveLibraries = allDeps.filter(lib => {
          const state = currentStates.get(lib.projectId);
          return state && state.exists && state.enabled;
        });
        
        const allDependencyIds = allActiveLibraries.map(lib => lib.projectId);
        const directDependencyIds = activeLibraries.map(lib => lib.projectId); // activeLibraries are the direct ones
        const libraryNames = activeLibraries.map(lib => lib.name).join(', ');
        
        onProgress?.(`[${currentTransaction}/${totalTransactions}] Registering ${allActiveLibraries.length} library dependencies (${directDependencyIds.length} direct). Please sign...`);
        console.log('[RoyaltyService] Registering project royalties...', { projectId, allDependencyIds, directDependencyIds });
        
        const regTx = await contract.registerProjectRoyalties(projectId, allDependencyIds, directDependencyIds);
        txHashes.register = regTx.hash;
        
        onProgress?.(`[${currentTransaction}/${totalTransactions}] Waiting for registration confirmation...`);
        await regTx.wait();
        console.log('[RoyaltyService] ✅ Project royalties registered');
      } else if (!needsRegistration && !needsRoyaltyPayment) {
        // CASE: Project update (registration done, payment done)
        console.log('[RoyaltyService] ✅ Project UPDATE - registration and payment already completed');
        txHashes.register = 'already-registered';
        
        // No payment needed for updates
        return {
          success: true,
          totalCostETH: 0,
          totalCostUSDC: 0,
          alreadyOwned: activeLibraries.length,
          txHashes,
          librariesWithOwners: []
        };
      } else if (!needsRegistration && needsRoyaltyPayment) {
        // CASE: Partial failure recovery (registration done, but payment failed/pending)
        console.log('[RoyaltyService] ⚠️ PARTIAL FAILURE RECOVERY');
        console.log('[RoyaltyService] Registration exists but no payment events found');
        console.log('[RoyaltyService] Will attempt to pay royalties (retry after failure)');
        txHashes.register = 'already-registered-retry-payment';
        // Continue to payment steps below
      } else {
        // CASE: No active libraries
        console.log('[RoyaltyService] ⚠️ No active libraries to register (all deleted/disabled)');
        txHashes.register = 'no-active-libraries';
        
        return {
          success: true,
          totalCostETH: 0,
          totalCostUSDC: 0,
          alreadyOwned: 0,
          txHashes,
          librariesWithOwners: []
        };
      }
      
      // STEP 2: Pay ETH royalties (for NEW projects OR partial failure recovery)
      if (totalRoyaltyETH > 0 && needsRoyaltyPayment) {
        currentTransaction++;
        const ethLibraries = activeLibraries.filter(lib => {
          const state = currentStates.get(lib.projectId);
          return state && state.ethAmount > 0;
        });
        const ethLibraryNames = ethLibraries.map(lib => {
          const state = currentStates.get(lib.projectId);
          return `${lib.name} (${state?.ethAmount} ETH)`;
        }).join(', ');
        
        onProgress?.(`[${currentTransaction}/${totalTransactions}] Paying ${formatETH(totalRoyaltyETH)} ETH royalty for: ${ethLibraryNames}. Please sign...`);
        console.log('[RoyaltyService] Paying ETH royalties...');
        
        const royaltyWei = ethers.parseEther(totalRoyaltyETH.toFixed(18));
        const ethTx = await contract.recordRoyalties(projectId, 0, 0, { value: royaltyWei });
        txHashes.paymentETH = ethTx.hash;
        
        onProgress?.(`[${currentTransaction}/${totalTransactions}] Waiting for ETH payment confirmation...`);
        await ethTx.wait();
        console.log('[RoyaltyService] ✅ Paid', totalRoyaltyETH, 'ETH in royalties');
      }
      
      // STEP 3: Pay USDC royalties (for NEW projects OR partial failure recovery)
      if (totalRoyaltyUSDC > 0 && needsRoyaltyPayment) {
        const usdcLibraries = activeLibraries.filter(lib => {
          const state = currentStates.get(lib.projectId);
          return state && state.usdcAmount > 0;
        });
        const usdcLibraryNames = usdcLibraries.map(lib => {
          const state = currentStates.get(lib.projectId);
          return `${lib.name} (${state?.usdcAmount} USDC)`;
        }).join(', ');
        
        // SECURITY FIX: Check USDC balance before approve
        const royaltyUnits = ethers.parseUnits(totalRoyaltyUSDC.toFixed(6), 6);
        const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);
        
        const userAddress = await signer.getAddress();
        const usdcBalance = await usdcContract.balanceOf(userAddress);
        
        if (usdcBalance < royaltyUnits) {
          const balanceFormatted = ethers.formatUnits(usdcBalance, 6);
          const requiredFormatted = totalRoyaltyUSDC.toFixed(6);
          throw new Error(
            `Insufficient USDC balance. ` +
            `Required: ${requiredFormatted} USDC, ` +
            `Available: ${balanceFormatted} USDC. ` +
            `Please add USDC to your wallet first.`
          );
        }
        
        // Approve
        currentTransaction++;
        onProgress?.(`[${currentTransaction}/${totalTransactions}] Approving ${formatUSDC(totalRoyaltyUSDC)} USDC for royalty payment. Please sign...`);
        console.log('[RoyaltyService] Approving USDC...');
        
        const approveTx = await usdcContract.approve(ROYALTY_CONTRACT_ADDRESS, royaltyUnits);
        txHashes.approveUSDC = approveTx.hash;
        
        onProgress?.(`[${currentTransaction}/${totalTransactions}] Waiting for USDC approval confirmation...`);
        await approveTx.wait();
        
        // Record payment
        currentTransaction++;
        onProgress?.(`[${currentTransaction}/${totalTransactions}] Paying ${formatUSDC(totalRoyaltyUSDC)} USDC royalty for: ${usdcLibraryNames}. Please sign...`);
        console.log('[RoyaltyService] Paying USDC royalties...');
        
        const usdcTx = await contract.recordRoyalties(projectId, 0, 1);
        txHashes.paymentUSDC = usdcTx.hash;
        
        onProgress?.(`[${currentTransaction}/${totalTransactions}] Waiting for USDC payment confirmation...`);
        await usdcTx.wait();
        console.log('[RoyaltyService] ✅ Paid', totalRoyaltyUSDC, 'USDC in royalties');
      }
      
      // Get current owners of each library
      const libraryContract = new ethers.Contract(
        process.env.NEXT_PUBLIC_LIBRARY_CONTRACT_ADDRESS || '',
        ['function getCurrentOwner(string projectId) external view returns (address)'],
        provider
      );
      
      // Get current owners for ACTIVE libraries only
      const librariesWithOwners = await Promise.all(
        activeLibraries.map(async (lib) => {
          try {
            const owner = await libraryContract.getCurrentOwner(lib.projectId);
            const state = currentStates.get(lib.projectId);
            return {
              projectId: lib.projectId,
              name: lib.name,
              owner: owner,
              royaltyETH: state?.ethAmount.toString() || '0',
              royaltyUSDC: state?.usdcAmount.toString() || '0'
            };
          } catch (error) {
            console.error('[RoyaltyService] Failed to get owner for', lib.projectId);
            return {
              projectId: lib.projectId,
              name: lib.name,
              owner: lib.creator || '',
              royaltyETH: '0',
              royaltyUSDC: '0'
            };
          }
        })
      );
      
      return { 
        success: true, 
        totalCostETH: totalRoyaltyETH, 
        totalCostUSDC: totalRoyaltyUSDC, 
        alreadyOwned: 0,
        txHashes,
        librariesWithOwners
      };
    }
    
    console.log('[RoyaltyService] ✅ All royalty transactions completed successfully');
    console.log('[RoyaltyService] Total paid - ETH:', totalRoyaltyETH, 'USDC:', totalRoyaltyUSDC);
    
    return { 
      success: true, 
      totalCostETH: totalRoyaltyETH, 
      totalCostUSDC: totalRoyaltyUSDC, 
      alreadyOwned: 0
    };
  } catch (error: any) {
    console.error('[RoyaltyService] Error:', error);
    return { success: false, totalCostETH: 0, totalCostUSDC: 0, alreadyOwned: 0, error: error.message };
  }
}

/**
 * Calculate minimum price based on royalties
 */
/**
 * Upload royalty payment receipt to Irys
 */
export async function uploadRoyaltyReceipt(receipt: RoyaltyReceipt): Promise<string | null> {
  try {
    console.log('[RoyaltyService] Uploading royalty receipt to Irys...');
    
    const receiptData = Buffer.from(JSON.stringify(receipt), 'utf-8');
    const tags = [
      { name: 'App-Name', value: 'GetClayed' },
      { name: 'Data-Type', value: 'royalty-receipt' },
      { name: 'Project-ID', value: receipt.projectId },
      { name: 'Project-Name', value: receipt.projectName },
      { name: 'Payer', value: receipt.payer.toLowerCase() },
      { name: 'Total-ETH', value: receipt.totalPaidETH },
      { name: 'Total-USDC', value: receipt.totalPaidUSDC },
      { name: 'Library-Count', value: receipt.libraries.length.toString() },
      { name: 'Timestamp', value: receipt.timestamp.toString() }
    ];
    
    // Add library owners as tags for easy querying
    receipt.libraries.forEach((lib, idx) => {
      tags.push({ name: `Library-${idx}-ID`, value: lib.projectId });
      tags.push({ name: `Library-${idx}-Owner`, value: lib.owner.toLowerCase() });
    });
    
    const result = await fixedKeyUploader.upload(receiptData, tags);
    const txId = typeof result === 'string' ? result : result.id;
    console.log('[RoyaltyService] ✅ Receipt uploaded:', txId);
    
    return txId;
  } catch (error) {
    console.error('[RoyaltyService] Failed to upload receipt:', error);
    return null;
  }
}

/**
 * Get royalty receipts for a user (as payer or library owner)
 * SECURITY: Verifies receipts are uploaded from trusted Solana address
 */
export async function getRoyaltyReceipts(userAddress: string, limit: number = 100): Promise<RoyaltyReceipt[]> {
  try {
    const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
    
    // SECURITY: Trusted uploader address (from fixed Solana key)
    // This prevents malicious users from uploading fake receipts
    const TRUSTED_UPLOADER_ADDRESS = process.env.NEXT_PUBLIC_TRUSTED_UPLOADER_ADDRESS;
    
    // Query receipts where user is the payer
    const payerQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["royalty-receipt"] },
            { name: "Payer", values: ["${userAddress.toLowerCase()}"] }
          ],
          first: ${limit},
          order: DESC
        ) {
          edges {
            node {
              id
              address
              timestamp
            }
          }
        }
      }
    `;
    
    // Query receipts where user is a library owner
    const ownerQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["royalty-receipt"] }
          ],
          first: ${limit * 2},
          order: DESC
        ) {
          edges {
            node {
              id
              address
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
    
    const [payerResponse, ownerResponse] = await Promise.all([
      fetch(IRYS_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: payerQuery })
      }),
      fetch(IRYS_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ownerQuery })
      })
    ]);
    
    const payerResult = await payerResponse.json();
    const ownerResult = await ownerResponse.json();
    
    const receipts: RoyaltyReceipt[] = [];
    const seenIds = new Set<string>();
    
    // Process payer receipts
    const payerEdges = payerResult.data?.transactions?.edges || [];
    for (const edge of payerEdges) {
      try {
        // SECURITY CHECK: Verify uploader address
        if (TRUSTED_UPLOADER_ADDRESS && edge.node.address !== TRUSTED_UPLOADER_ADDRESS) {
          console.warn('[RoyaltyService] ⚠️ Skipping receipt from untrusted uploader:', edge.node.id);
          console.warn(`  Expected: ${TRUSTED_UPLOADER_ADDRESS}`);
          console.warn(`  Got: ${edge.node.address}`);
          continue;
        }
        
        const dataResponse = await fetch(`https://uploader.irys.xyz/tx/${edge.node.id}/data`);
        const receipt = await dataResponse.json();
        receipts.push(receipt);
        seenIds.add(edge.node.id);
      } catch (error) {
        console.error('[RoyaltyService] Failed to load receipt:', edge.node.id);
      }
    }
    
    // Process owner receipts (filter by library owner tags)
    const ownerEdges = ownerResult.data?.transactions?.edges || [];
    for (const edge of ownerEdges) {
      if (seenIds.has(edge.node.id)) continue;
      
      // SECURITY CHECK: Verify uploader address
      if (TRUSTED_UPLOADER_ADDRESS && edge.node.address !== TRUSTED_UPLOADER_ADDRESS) {
        console.warn('[RoyaltyService] ⚠️ Skipping receipt from untrusted uploader:', edge.node.id);
        continue;
      }
      
      const tags = edge.node.tags.reduce((acc: any, tag: any) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      
      // Get library count from tags
      const libraryCount = parseInt(tags['Library-Count'] || '0');
      
      // Check if user is a library owner in this receipt
      let isOwner = false;
      for (let i = 0; i < libraryCount; i++) {
        const ownerTag = tags[`Library-${i}-Owner`];
        if (ownerTag && ownerTag.toLowerCase() === userAddress.toLowerCase()) {
          isOwner = true;
          break;
        }
      }
      
      if (isOwner) {
        try {
          const dataResponse = await fetch(`https://uploader.irys.xyz/tx/${edge.node.id}/data`);
          const receipt = await dataResponse.json();
          receipts.push(receipt);
          seenIds.add(edge.node.id);
        } catch (error) {
          console.error('[RoyaltyService] Failed to load receipt:', edge.node.id);
        }
      }
    }
    
    // Sort by timestamp (newest first)
    receipts.sort((a, b) => b.timestamp - a.timestamp);
    
    return receipts.slice(0, limit);
  } catch (error) {
    console.error('[RoyaltyService] Error getting royalty receipts:', error);
    return [];
  }
}

/**
 * Calculate minimum price based on stored library data (DEPRECATED - Use calculateMinimumPriceFromBlockchain)
 * WARNING: This uses stored values which may be outdated!
 */
export async function calculateMinimumPrice(
  usedLibraries: LibraryDependency[]
): Promise<{ minETH: number; minUSDC: number }> {
  if (usedLibraries.length === 0) {
    return { minETH: 0, minUSDC: 0 };
  }
  
  // Sum up direct royalty amounts from stored data
  const minETH = usedLibraries.reduce((sum, lib) => {
    return sum + parseFloat(lib.royaltyPerImportETH || '0');
  }, 0);
  
  const minUSDC = usedLibraries.reduce((sum, lib) => {
    return sum + parseFloat(lib.royaltyPerImportUSDC || '0');
  }, 0);
  
  return { minETH, minUSDC };
}

