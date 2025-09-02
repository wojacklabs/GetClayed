const axios = require('axios');

async function checkChunks() {
  const chunkSetId = '68ae44eb-5857-48d7-b338-a9fdf9feb9f5'; // From the error log
  
  console.log(`=== Checking chunks for set: ${chunkSetId} ===\n`);
  
  // 1. Query with App-Name
  const queryWithAppName = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["GetClayed"] }
          { name: "Data-Type", values: ["clay-project-chunk"] }
          { name: "Chunk-Set-ID", values: ["${chunkSetId}"] }
        ]
        first: 100
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
  
  // 2. Query without App-Name
  const queryWithoutAppName = `
    query {
      transactions(
        tags: [
          { name: "Data-Type", values: ["clay-project-chunk"] }
          { name: "Chunk-Set-ID", values: ["${chunkSetId}"] }
        ]
        first: 100
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
  
  try {
    // Test query with App-Name
    console.log('1. Query WITH App-Name tag:');
    const response1 = await axios.post('https://uploader.irys.xyz/graphql', {
      query: queryWithAppName
    });
    
    const edges1 = response1.data?.data?.transactions?.edges || [];
    console.log(`Found ${edges1.length} chunks\n`);
    
    // Test query without App-Name
    console.log('2. Query WITHOUT App-Name tag:');
    const response2 = await axios.post('https://uploader.irys.xyz/graphql', {
      query: queryWithoutAppName
    });
    
    const edges2 = response2.data?.data?.transactions?.edges || [];
    console.log(`Found ${edges2.length} chunks\n`);
    
    if (edges2.length > 0) {
      console.log('Chunk details:');
      edges2.forEach((edge, index) => {
        const tags = {};
        edge.node.tags.forEach(tag => {
          tags[tag.name] = tag.value;
        });
        
        console.log(`\nChunk ${index + 1}:`);
        console.log(`  TX ID: ${edge.node.id}`);
        console.log(`  Chunk Index: ${tags['Chunk-Index'] || 'N/A'}`);
        console.log(`  App-Name: ${tags['App-Name'] || 'MISSING!'}`);
      });
    }
    
    // 3. Check one of the chunk IDs from the manifest
    const chunkIds = [
      'DAJDJ9VtDxqo9pPjCbjKMiPJ3T5ZpMCT9r8AvnHHDGHC',
      'Go1J5u3wnD9r4h7C5apmA6zBJJ6Jmyxm6VaWJYGYh3rY',
      'HFa8N9LzHrN7hEcw4VYsYHCxSuqKu5PvHEJjJJQyEA12',
      'FQdJfJKoHMoHSuYxJTJKvcJJcA6Gyt4MJRo3vmJTJpJJ',
      'F1aUHJNJ2w8BJCvJJJKJBJRJpJJvJJrJKJJJJ8JpJJJK',
      'HFJuJJJKJKJJJJJJJJ
