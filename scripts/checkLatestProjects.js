/**
 * Check the latest projects with full details
 */

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

async function checkLatestProjects() {
  try {
    console.log('🔍 Querying latest projects (last hour)...');
    console.log('');

    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    // Query recent projects
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["clay-project"] }
          ],
          first: 10,
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

    console.log('📦 Latest', edges.length, 'projects:');
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
      const txId = edge.node.id;

      console.log(`${i + 1}. ${name}`);
      console.log(`   Project ID: ${projectId}`);
      console.log(`   TX ID: ${txId}`);
      console.log(`   Author: ${author}`);
      console.log(`   Uploaded: ${timestamp.toLocaleString()}`);
      
      // Try to download project data
      try {
        const dataResponse = await fetch(`https://uploader.irys.xyz/tx/${txId}/data`);
        const text = await dataResponse.text();
        
        // Check if it's a manifest (chunked)
        if (text.includes('chunkSetId')) {
          const manifest = JSON.parse(text);
          console.log(`   📦 Chunked data: ${manifest.totalChunks} chunks`);
          
          // Download first chunk to get basic info
          if (manifest.chunks && manifest.chunks.length > 0) {
            try {
              const chunkResponse = await fetch(`https://uploader.irys.xyz/tx/${manifest.chunks[0]}/data`);
              const chunkData = await chunkResponse.text();
              
              // Try to extract usedLibraries from first chunk
              if (chunkData.includes('usedLibraries')) {
                const match = chunkData.match(/"usedLibraries":\s*\[([^\]]*)\]/);
                if (match) {
                  console.log(`   📚 ✅ HAS LIBRARY DEPENDENCIES`);
                }
              }
            } catch (err) {
              // Ignore
            }
          }
        } else {
          // Direct data
          const projectData = JSON.parse(text);
          if (projectData.usedLibraries && projectData.usedLibraries.length > 0) {
            console.log(`   📚 ✅ USES ${projectData.usedLibraries.length} LIBRARIES:`);
            projectData.usedLibraries.forEach((lib, idx) => {
              console.log(`      ${idx + 1}. ${lib.name} (${lib.projectId})`);
              console.log(`         Royalty: ${lib.royaltyPerImportETH || '0'} ETH, ${lib.royaltyPerImportUSDC || '0'} USDC`);
            });
          }
        }
      } catch (error) {
        console.log(`   ⚠️ Could not load project data`);
      }
      
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkLatestProjects();

