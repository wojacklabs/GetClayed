import { providers } from 'ethers';

/**
 * Creates an Irys-compatible wallet from Privy's embedded wallet provider
 */
export async function createIrysWallet(privyProvider: any) {
  // Create ethers provider from Privy's EIP-1193 provider
  const ethersProvider = new providers.Web3Provider(privyProvider);
  const signer = ethersProvider.getSigner();
  
  // Get signer address and balance
  const address = await signer.getAddress();
  const balance = await signer.getBalance();
  
  // Create a provider wrapper that includes estimateGas
  const providerWithEstimateGas = {
    ...privyProvider,
    estimateGas: async (transaction: any) => {
      return await ethersProvider.estimateGas(transaction);
    },
    getGasPrice: async () => {
      return await ethersProvider.getGasPrice();
    },
    getBlockNumber: async () => {
      return await ethersProvider.getBlockNumber();
    },
    getTransactionCount: async (address: string) => {
      return await ethersProvider.getTransactionCount(address);
    },
    call: async (transaction: any) => {
      return await ethersProvider.call(transaction);
    },
    request: async (args: any) => {
      return await privyProvider.request(args);
    }
  };

  // Create an Irys-compatible wallet object
  const irysWallet = {
    // Required wallet properties
    address: address,
    balance: balance,
    provider: providerWithEstimateGas,
    
    // Required wallet methods
    signMessage: async (message: string) => {
      return await signer.signMessage(message);
    },
    sendTransaction: async (tx: any) => {
      const transaction = await signer.sendTransaction(tx);
      return transaction;
    },
    getBalance: async () => {
      return await signer.getBalance();
    },
    
    // Provider pass-through
    request: async (args: any) => {
      return await privyProvider.request(args);
    },
    
    // Additional signer methods that might be needed
    getAddress: async () => {
      return address;
    }
  };

  return irysWallet;
}
