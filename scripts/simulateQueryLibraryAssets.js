const { ethers } = require('ethers');

const OLD_LIBRARY = '0x400501A45664B3493Fb6f1E1BB574187BBBB8AA4';
const NEW_LIBRARY = '0xA742D5B85DE818F4584134717AC18930B6cAFE1e';
const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql'\;
const BASE_RPC_URL = 'https://mainnet.base.org'\;

const LIBRARY_ABI = [
  'function getAsset(string projectId) external view returns (tuple(string projectId, string name, string description, uint256 royaltyPerImportETH, uint256 royaltyPerImportUSDC, address currentOwner, address originalCreator, uint256 listedAt, bool exists, bool royaltyEnabled))'
];

async function simulateQuery(contractAddress, label) {
  console.log('\\n' + '='.repeat(60));
  console.log(`${label}: ${contractAddress}`);
  console.log('='.repeat(60));
  
  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["GetClayed"] },
          { name: "Data-Type", values: ["library-registration"] }
        ],
        first: 10,
        order: DESC
      ) {
        edges {
          node {
            id
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
  
  const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  const contract = new ethers.Contract(contractAddress, LIBRARY_ABI, provider);
  
  const seen = new Set();
  const finalAssets = [];
  
  for (const edge of edges) {
    const tags = edge.node.tags.reduce((acc, tag) => {
      acc[tag.name] = tag.value;
      return acc;
    }, {});
    
    const projectId = tags['Project-ID'];
    if (seen.has(projectId)) continue;
    seen.add(projectId);
    
    try {
      const blockchainData = await contract.getAsset(projectId);
      
      if (blockchainData.exists && blockchainData.royaltyEnabled) {
        finalAssets.push({
          name: blockchainData.name,
          projectId: projectId
        });
      } else {
        console.log(`   ⏭️  Skipped: ${tags['Asset-Name']} (exists: ${blockchainData.exists}, enabled: ${blockchainData.royaltyEnabled})`);
      }
    } catch (error) {
      console.log(`   ⏭️  Skipped: ${tags['Asset-Name']} (not in contract)`);
    }
  }
  
  console.log(`\\nFinal results: ${finalAssets.length} libraries\\n`);
  finalAssets.forEach((asset, idx) => {
    console.log(`${idx + 1}. ${asset.name}`);
  });
}

async function main() {
  console.log('Simulating queryLibraryAssets() with different contracts...\\n');
  
  await simulateQuery(OLD_LIBRARY, 'OLD Library (10/28)');
  await simulateQuery(NEW_LIBRARY, 'NEW Library (11/06)');
}

main();
