const axios = require('axios');

async function findLatestChunks() {
  console.log('=== Finding Latest Chunks ===\n');
  
  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["GetClayed"] }
          { name: "Data-Type", values: ["clay-project-chunk", "clay-project-manifest"] }
          { name: "Author", values: ["0x0e8fa0f817cd3e70a4bc9c18bef3d6cad2c2c738"] }
        ]
        first: 20
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
  
  try {
    const response = await axios.post('https://uploader.irys.xyz/graphql', {
      query
    });
    
    const edges = response.data?.data?.transactions?.edges || [];
    console.log(`Found ${edges.length} recent transactions\n`);
    
    // Group by chunk set
    const chunkSets = {};
    const manifests = [];
    
    edges.forEach((edge) => {
      const tags = {};
      edge.node.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });
      
      if (tags['Data-Type'] === 'clay-project-manifest') {
        manifests.push({
          id: edge.node.id,
          timestamp: edge.node.timestamp,
          projectName: tags['Project-Name'],
          chunkSetId: tags['Chunk-Set-ID'],
          totalChunks: tags['Total-Chunks']
        });
      } else if (tags['Data-Type'] === 'clay-project-chunk') {
        const setId = tags['Chunk-Set-ID'];
        if (!chunkSets[setId]) {
          chunkSets[setId] = {
            projectName: tags['Project-Name'],
            chunks: []
          };
        }
        chunkSets[setId].chunks.push({
          id: edge.node.id,
          index: parseInt(tags['Chunk-Index']),
          timestamp: edge.node.timestamp
        });
      }
    });
    
    // Display manifests
    console.log('Manifests:');
    manifests.forEach(m => {
      console.log(`\n- ${m.projectName} (${m.id})`);
      console.log(`  Chunk Set ID: ${m.chunkSetId}`);
      console.log(`  Total Chunks: ${m.totalChunks}`);
      console.log(`  Timestamp: ${new Date(m.timestamp * 1000).toISOString()}`);
    });
    
    // Display chunk sets
    console.log('\n\nChunk Sets:');
    Object.entries(chunkSets).forEach(([setId, data]) => {
      console.log(`\n- Set ID: ${setId}`);
      console.log(`  Project: ${data.projectName}`);
      console.log(`  Found ${data.chunks.length} chunks`);
      data.chunks.sort((a, b) => a.index - b.index);
      console.log(`  Indices: ${data.chunks.map(c => c.index).join(', ')}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

findLatestChunks();
