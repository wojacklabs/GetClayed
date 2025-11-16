import { ethers } from 'ethers';

// RPC endpoints configuration
// Note: Excluding the first RPC endpoint as it has reliability issues
const RPC_ENDPOINTS = [
  'https://base.meowrpc.com',
  'https://base.publicnode.com',
  'https://1rpc.io/base',
  'https://base-rpc.publicnode.com'
];

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequestsPerSecond: 2,
  maxRetries: 1,
  retryDelay: 1000, // ms
  cooldownPeriod: 5000 // ms after rate limit hit
};

// Request tracking
interface RequestTracker {
  count: number;
  resetTime: number;
  lastRateLimitHit: number;
}

const requestTracker: RequestTracker = {
  count: 0,
  resetTime: Date.now() + 1000,
  lastRateLimitHit: 0
};

// Singleton providers cache
const providerCache = new Map<string, ethers.JsonRpcProvider>();

// Current RPC endpoint index
let currentRpcIndex = 0;

/**
 * Get the next RPC endpoint in rotation
 */
function getNextRpcEndpoint(): string {
  const endpoint = RPC_ENDPOINTS[currentRpcIndex];
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  return endpoint;
}

/**
 * Check if we should wait due to rate limiting
 */
async function checkRateLimit(): Promise<void> {
  const now = Date.now();
  
  // Reset counter if time window passed
  if (now >= requestTracker.resetTime) {
    requestTracker.count = 0;
    requestTracker.resetTime = now + 1000;
  }
  
  // Check if in cooldown period
  if (requestTracker.lastRateLimitHit > 0 && now - requestTracker.lastRateLimitHit < RATE_LIMIT.cooldownPeriod) {
    const waitTime = RATE_LIMIT.cooldownPeriod - (now - requestTracker.lastRateLimitHit);
    console.log(`[RPC] In cooldown period, waiting ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    requestTracker.lastRateLimitHit = 0;
  }
  
  // Check if we've hit the rate limit
  if (requestTracker.count >= RATE_LIMIT.maxRequestsPerSecond) {
    const waitTime = requestTracker.resetTime - now;
    if (waitTime > 0) {
      console.log(`[RPC] Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      // Reset after waiting
      requestTracker.count = 0;
      requestTracker.resetTime = Date.now() + 1000;
    }
  }
  
  requestTracker.count++;
}

/**
 * Get or create a provider with rate limiting and fallback
 */
export async function getProvider(): Promise<ethers.JsonRpcProvider> {
  let lastError: Error | null = null;
  
  // Try each RPC endpoint
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const rpcUrl = getNextRpcEndpoint();
    
    // Check if we have a cached provider for this URL
    if (providerCache.has(rpcUrl)) {
      const cachedProvider = providerCache.get(rpcUrl)!;
      try {
        // Test if the provider is still working
        await checkRateLimit();
        await cachedProvider.getBlockNumber();
        return cachedProvider;
      } catch (error) {
        // Provider failed, remove from cache
        providerCache.delete(rpcUrl);
        console.log(`[RPC] Cached provider failed for ${rpcUrl}, trying next`);
      }
    }
    
    // Create new provider
    try {
      await checkRateLimit();
      
      const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
        staticNetwork: true,
        polling: false,
        batchMaxCount: 1
      });
      
      // Test the provider
      await provider.getBlockNumber();
      
      // Cache the working provider
      providerCache.set(rpcUrl, provider);
      
      console.log(`[RPC] Successfully connected to ${rpcUrl}`);
      return provider;
    } catch (error: any) {
      lastError = error;
      
      // Check if rate limited
      if (error.code === 429 || error.message?.includes('429')) {
        console.log(`[RPC] Rate limited on ${rpcUrl}`);
        requestTracker.lastRateLimitHit = Date.now();
      } else {
        console.log(`[RPC] Failed to connect to ${rpcUrl}:`, error.message);
      }
    }
  }
  
  // All endpoints failed
  throw new Error(`All RPC endpoints failed. Last error: ${lastError?.message}`);
}

/**
 * Execute a contract call with retry and rate limiting
 */
export async function executeContractCall<T>(
  contractAddress: string,
  abi: any[],
  method: string,
  args: any[] = []
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < RATE_LIMIT.maxRetries; attempt++) {
    try {
      const provider = await getProvider();
      const contract = new ethers.Contract(contractAddress, abi, provider);
      
      // Make the call
      const result = await contract[method](...args);
      return result;
    } catch (error: any) {
      lastError = error;
      
      // If it's a contract error (not RPC error), don't retry
      if (error.code === 'CALL_EXCEPTION') {
        throw error;
      }
      
      // Rate limit error - wait before retry
      if (error.code === 429 || error.message?.includes('429')) {
        requestTracker.lastRateLimitHit = Date.now();
      }
      
      console.log(`[RPC] Contract call failed (attempt ${attempt + 1}):`, error.message);
      
      // Wait before retry
      if (attempt < RATE_LIMIT.maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.retryDelay));
      }
    }
  }
  
  throw new Error(`Contract call failed after ${RATE_LIMIT.maxRetries} attempts. Last error: ${lastError?.message}`);
}

/**
 * Batch multiple contract calls to reduce RPC requests
 */
export async function batchContractCalls<T>(
  calls: Array<{
    contractAddress: string;
    abi: any[];
    method: string;
    args: any[];
  }>
): Promise<T[]> {
  const results: T[] = [];
  const provider = await getProvider();
  
  // Process calls in smaller batches to avoid overwhelming the RPC
  const batchSize = 5;
  for (let i = 0; i < calls.length; i += batchSize) {
    const batch = calls.slice(i, i + batchSize);
    
    await checkRateLimit();
    
    const batchPromises = batch.map(async (call) => {
      const contract = new ethers.Contract(call.contractAddress, call.abi, provider);
      return contract[call.method](...call.args);
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // Return null for failed calls
        results.push(null as any);
      }
    }
    
    // Small delay between batches
    if (i + batchSize < calls.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return results;
}
