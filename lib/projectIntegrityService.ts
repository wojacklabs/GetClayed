import { ethers } from 'ethers';
import { ClayProject } from './clayStorageService';

/**
 * Project Integrity Service
 * Ensures project data and library dependencies cannot be tampered with
 */

export interface ProjectSignature {
  projectId: string;
  librariesHash: string; // Hash of usedLibraries array
  clayDataHash: string; // Hash of clays array
  signature: string; // Wallet signature of combined hash
  signedBy: string; // Wallet address
  signedAt: number; // Timestamp
}

/**
 * Calculate hash of library dependencies
 */
function hashLibraries(libraries: any[]): string {
  if (!libraries || libraries.length === 0) {
    return ethers.keccak256(ethers.toUtf8Bytes('NO_LIBRARIES'));
  }
  
  // Sort libraries by projectId for consistent hashing
  const sorted = [...libraries].sort((a, b) => 
    a.projectId.localeCompare(b.projectId)
  );
  
  // Create canonical representation
  const canonical = sorted.map(lib => ({
    projectId: lib.projectId,
    royaltyPerImportETH: lib.royaltyPerImportETH || '0',
    royaltyPerImportUSDC: lib.royaltyPerImportUSDC || '0'
  }));
  
  const json = JSON.stringify(canonical);
  return ethers.keccak256(ethers.toUtf8Bytes(json));
}

/**
 * Calculate hash of clay data (focusing on library sources)
 */
function hashClayData(clays: any[]): string {
  if (!clays || clays.length === 0) {
    return ethers.keccak256(ethers.toUtf8Bytes('NO_CLAYS'));
  }
  
  // Extract library source information from each clay
  const librarySources = clays
    .filter(clay => clay.librarySourceId)
    .map(clay => ({
      id: clay.id,
      librarySourceId: clay.librarySourceId,
      librarySourceName: clay.librarySourceName
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  
  const json = JSON.stringify(librarySources);
  return ethers.keccak256(ethers.toUtf8Bytes(json));
}

/**
 * Sign project data to ensure integrity
 * This prevents tampering with library dependencies after download
 */
export async function signProjectData(
  project: ClayProject,
  provider: any
): Promise<ProjectSignature> {
  try {
    console.log('[ProjectIntegrity] Signing project data...');
    
    // Calculate hashes
    const librariesHash = hashLibraries(project.usedLibraries || []);
    const clayDataHash = hashClayData(project.clays || []);
    
    console.log('[ProjectIntegrity] Libraries hash:', librariesHash);
    console.log('[ProjectIntegrity] Clay data hash:', clayDataHash);
    
    // Combine hashes
    const combinedHash = ethers.keccak256(
      ethers.concat([
        ethers.toUtf8Bytes(project.id),
        ethers.getBytes(librariesHash),
        ethers.getBytes(clayDataHash)
      ])
    );
    
    console.log('[ProjectIntegrity] Combined hash:', combinedHash);
    
    // Get signer
    const ethersProvider = new ethers.BrowserProvider(provider);
    const signer = await ethersProvider.getSigner();
    const signerAddress = await signer.getAddress();
    
    // Sign the combined hash
    const signature = await signer.signMessage(ethers.getBytes(combinedHash));
    
    console.log('[ProjectIntegrity] Signature created:', signature);
    
    const projectSignature: ProjectSignature = {
      projectId: project.id,
      librariesHash,
      clayDataHash,
      signature,
      signedBy: signerAddress.toLowerCase(),
      signedAt: Date.now()
    };
    
    return projectSignature;
  } catch (error) {
    console.error('[ProjectIntegrity] Error signing project:', error);
    throw error;
  }
}

/**
 * Verify project signature
 * Returns true if signature is valid and data hasn't been tampered with
 */
export async function verifyProjectSignature(
  project: ClayProject,
  signature: ProjectSignature
): Promise<{ valid: boolean; error?: string }> {
  try {
    console.log('[ProjectIntegrity] Verifying project signature...');
    
    // Recalculate hashes from current project data
    const currentLibrariesHash = hashLibraries(project.usedLibraries || []);
    const currentClayDataHash = hashClayData(project.clays || []);
    
    console.log('[ProjectIntegrity] Current libraries hash:', currentLibrariesHash);
    console.log('[ProjectIntegrity] Stored libraries hash:', signature.librariesHash);
    console.log('[ProjectIntegrity] Current clay data hash:', currentClayDataHash);
    console.log('[ProjectIntegrity] Stored clay data hash:', signature.clayDataHash);
    
    // Check if hashes match
    if (currentLibrariesHash !== signature.librariesHash) {
      console.error('[ProjectIntegrity] ❌ Libraries hash mismatch!');
      return { 
        valid: false, 
        error: 'Library dependencies have been tampered with' 
      };
    }
    
    if (currentClayDataHash !== signature.clayDataHash) {
      console.error('[ProjectIntegrity] ❌ Clay data hash mismatch!');
      return { 
        valid: false, 
        error: 'Clay library sources have been tampered with' 
      };
    }
    
    // Reconstruct the message that was signed
    const combinedHash = ethers.keccak256(
      ethers.concat([
        ethers.toUtf8Bytes(signature.projectId),
        ethers.getBytes(signature.librariesHash),
        ethers.getBytes(signature.clayDataHash)
      ])
    );
    
    // Recover the signer's address
    const recoveredAddress = ethers.verifyMessage(
      ethers.getBytes(combinedHash),
      signature.signature
    );
    
    console.log('[ProjectIntegrity] Recovered address:', recoveredAddress);
    console.log('[ProjectIntegrity] Expected address:', signature.signedBy);
    
    // Check if signature is from the claimed signer
    if (recoveredAddress.toLowerCase() !== signature.signedBy.toLowerCase()) {
      console.error('[ProjectIntegrity] ❌ Signature verification failed!');
      return { 
        valid: false, 
        error: 'Invalid signature - project may have been forged' 
      };
    }
    
    // Check if signer is the project author
    if (signature.signedBy.toLowerCase() !== project.author.toLowerCase()) {
      console.warn('[ProjectIntegrity] ⚠️ Signer is not the project author');
      return { 
        valid: false, 
        error: 'Signature is valid but not from project author' 
      };
    }
    
    console.log('[ProjectIntegrity] ✅ Signature is valid');
    return { valid: true };
  } catch (error: any) {
    console.error('[ProjectIntegrity] Error verifying signature:', error);
    return { 
      valid: false, 
      error: error.message || 'Signature verification failed' 
    };
  }
}

/**
 * Auto-detect libraries from clay objects and verify against declared libraries
 * Updated to handle hierarchical library dependencies properly
 */
export function detectLibraryTampering(project: ClayProject): {
  tampered: boolean;
  detectedLibraries: string[];
  declaredLibraries: string[];
  missing: string[];
  extra: string[];
} {
  // Extract unique library source IDs from clay objects
  const detectedSet = new Set<string>();
  
  project.clays.forEach(clay => {
    if (clay.librarySourceId) {
      detectedSet.add(clay.librarySourceId);
    }
  });
  
  const detectedLibraries = Array.from(detectedSet);
  const declaredLibraries = (project.usedLibraries || []).map(lib => lib.projectId);
  const directImports = project.directImports || [];
  
  // For hierarchical libraries, we only need to check if direct imports are present
  // Indirect dependencies (libraries used by our imported libraries) don't need to be in clay objects
  const requiredLibraries = detectedLibraries.filter(id => {
    // If it's in directImports, it must be in declaredLibraries
    if (directImports.includes(id)) {
      return true;
    }
    // If it's not a direct import but is detected in clay objects,
    // it should still be in declaredLibraries (as an indirect dependency)
    return true;
  });
  
  // Find missing libraries - only those that are actually detected in clay objects
  const missing = requiredLibraries.filter(id => !declaredLibraries.includes(id));
  
  // Extra libraries are OK - they might be indirect dependencies not used in current clay objects
  const extra: string[] = [];
  
  const tampered = missing.length > 0;
  
  if (tampered) {
    console.warn('[ProjectIntegrity] ⚠️ Library tampering detected!');
    console.warn('  Detected in clay objects:', detectedLibraries);
    console.warn('  Declared in usedLibraries:', declaredLibraries);
    console.warn('  Direct imports:', directImports);
    console.warn('  Missing from declaration:', missing);
    console.warn('  Note: Indirect dependencies in usedLibraries but not in clay objects are normal');
  }
  
  return {
    tampered,
    detectedLibraries,
    declaredLibraries,
    missing,
    extra
  };
}



