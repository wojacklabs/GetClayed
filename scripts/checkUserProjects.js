/**
 * Check user's projects and their library dependencies
 */

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

async function checkUserProjects(walletAddress) {
  try {
    console.log('🔍 Querying projects for:', walletAddress);
    console.log('');

    // Query projects from Irys
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["clay-project"] },
            { name: "Author", values: ["${walletAddress.toLowerCase()}"] }
          ],
          first: 50,
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

    console.log('📦 Found', edges.length, 'projects');
    console.log('═══════════════════════════════════════');
    console.log('');

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const tags = edge.node.tags.reduce((acc, tag) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});

      const projectId = tags['Project-ID'];
      const name = tags['Project-Name'] || 'Unnamed';
      const timestamp = new Date(parseInt(edge.node.timestamp));

      console.log(`${i + 1}. ${name}`);
      console.log(`   Project ID: ${projectId}`);
      console.log(`   Uploaded: ${timestamp.toLocaleString()}`);
      
      // Download project data to check usedLibraries
      try {
        const dataResponse = await fetch(`https://uploader.irys.xyz/tx/${edge.node.id}/data`);
        const projectData = await dataResponse.json();
        
        if (projectData.usedLibraries && projectData.usedLibraries.length > 0) {
          console.log(`   📚 Uses ${projectData.usedLibraries.length} libraries:`);
          projectData.usedLibraries.forEach((lib, idx) => {
            console.log(`      ${idx + 1}. ${lib.name} (${lib.projectId})`);
            console.log(`         Royalty: ${lib.royaltyPerImportETH || lib.priceETH || '0'} ETH, ${lib.royaltyPerImportUSDC || lib.priceUSDC || '0'} USDC`);
            console.log(`         Creator: ${lib.creator}`);
          });
        } else {
          console.log(`   No libraries used`);
        }
      } catch (error) {
        console.log(`   ❌ Failed to load project data`);
      }
      
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const walletAddress = process.argv[2];

if (!walletAddress) {
  console.error('❌ Usage: node scripts/checkUserProjects.js <walletAddress>');
  console.error('');
  console.error('Example: node scripts/checkUserProjects.js 0xad6c8211dfbb44b090926f6143f8daf98fc35aaa');
  process.exit(1);
}

checkUserProjects(walletAddress);

