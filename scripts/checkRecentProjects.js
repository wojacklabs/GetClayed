/**
 * Check recent projects with library dependencies
 */

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

async function checkRecentProjects() {
  try {
    console.log('🔍 Querying recent projects with libraries...');
    console.log('');

    // Query recent projects
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["clay-project"] }
          ],
          first: 20,
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

    console.log('📦 Found', edges.length, 'recent projects');
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
      const author = tags['Author'];
      const timestamp = new Date(parseInt(edge.node.timestamp));

      console.log(`${i + 1}. ${name}`);
      console.log(`   Project ID: ${projectId}`);
      console.log(`   Author: ${author}`);
      console.log(`   Uploaded: ${timestamp.toLocaleString()}`);
      
      // Download project data to check usedLibraries
      try {
        const dataResponse = await fetch(`https://uploader.irys.xyz/tx/${edge.node.id}/data`);
        const projectData = await dataResponse.json();
        
        if (projectData.usedLibraries && projectData.usedLibraries.length > 0) {
          console.log(`   📚 ✅ USES ${projectData.usedLibraries.length} LIBRARIES:`);
          projectData.usedLibraries.forEach((lib, idx) => {
            console.log(`      ${idx + 1}. ${lib.name} (${lib.projectId})`);
            console.log(`         Royalty: ${lib.royaltyPerImportETH || lib.priceETH || '0'} ETH, ${lib.royaltyPerImportUSDC || lib.priceUSDC || '0'} USDC`);
            console.log(`         Creator: ${lib.creator}`);
          });
        }
      } catch (error) {
        // Might be chunked
      }
      
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRecentProjects();

