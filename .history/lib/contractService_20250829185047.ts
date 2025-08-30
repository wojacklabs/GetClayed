import { ethers } from 'ethers';

// Clay NFT Contract ABI (0.1 IRYS fee for minting)
const CLAY_NFT_ABI = [
  'function publicMint(address to, string memory metadataUri) public payable',
  'function getMintPrice() public view returns (uint256)',
  'function balanceOf(address owner) public view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) public view returns (uint256)',
  'function tokenURI(uint256 tokenId) public view returns (string)',
  'event NFTMinted(address indexed to, uint256 indexed tokenId, string metadataUri)'
];

export class ClayNFTContract {
  private contract: ethers.Contract;
  private provider: ethers.providers.Provider;
  
  constructor(provider: ethers.providers.Provider) {
    this.provider = provider;
    this.contract = new ethers.Contract(
      process.env.NEXT_PUBLIC_CLAY_NFT_CONTRACT_ADDRESS || '',
      CLAY_NFT_ABI,
      provider
    );
  }
  
  /**
   * Get the mint price (should be 0.1 IRYS)
   */
  async getMintPrice(): Promise<string> {
    const price = await this.contract.getMintPrice();
    return ethers.utils.formatEther(price);
  }
  
  /**
   * Mint a clay project as NFT
   */
  async mintClayNFT(
    signer: ethers.Signer,
    recipientAddress: string,
    metadataUri: string
  ): Promise<ethers.ContractTransaction> {
    const contractWithSigner = this.contract.connect(signer);
    const mintPrice = await this.contract.getMintPrice();
    
    console.log(`[ClayNFTContract] Minting NFT to ${recipientAddress}`);
    console.log(`[ClayNFTContract] Metadata URI: ${metadataUri}`);
    console.log(`[ClayNFTContract] Mint price: ${ethers.utils.formatEther(mintPrice)} IRYS`);
    
    const tx = await contractWithSigner.publicMint(recipientAddress, metadataUri, {
      value: mintPrice
    });
    
    return tx;
  }
  
  /**
   * Get user's clay NFT balance
   */
  async getBalance(address: string): Promise<number> {
    const balance = await this.contract.balanceOf(address);
    return balance.toNumber();
  }
  
  /**
   * Get token IDs owned by user
   */
  async getTokensByOwner(address: string): Promise<number[]> {
    const balance = await this.getBalance(address);
    const tokenIds: number[] = [];
    
    for (let i = 0; i < balance; i++) {
      const tokenId = await this.contract.tokenOfOwnerByIndex(address, i);
      tokenIds.push(tokenId.toNumber());
    }
    
    return tokenIds;
  }
  
  /**
   * Get metadata URI for a token
   */
  async getTokenURI(tokenId: number): Promise<string> {
    return await this.contract.tokenURI(tokenId);
  }
  
  /**
   * Listen for NFT minted events
   */
  onNFTMinted(
    callback: (to: string, tokenId: number, metadataUri: string) => void
  ): () => void {
    const filter = this.contract.filters.NFTMinted();
    
    const listener = (to: string, tokenId: ethers.BigNumber, metadataUri: string) => {
      callback(to, tokenId.toNumber(), metadataUri);
    };
    
    this.contract.on(filter, listener);
    
    // Return cleanup function
    return () => {
      this.contract.off(filter, listener);
    };
  }
}

/**
 * Create NFT metadata for clay project
 */
export function createClayNFTMetadata(
  projectName: string,
  description: string,
  author: string,
  projectUri: string,
  imageUri?: string
): any {
  return {
    name: projectName,
    description: description || 'A 3D clay sculpture created with GetClayed',
    image: imageUri || 'https://gateway.irys.xyz/default-clay-image', // You should upload a preview image
    external_url: `https://getclayed.com/project/${projectUri}`,
    attributes: [
      {
        trait_type: 'Author',
        value: author
      },
      {
        trait_type: 'Created With',
        value: 'GetClayed'
      },
      {
        trait_type: 'Storage',
        value: 'Irys'
      }
    ],
    properties: {
      project_uri: projectUri,
      created_at: Date.now()
    }
  };
}
