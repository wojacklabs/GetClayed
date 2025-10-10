async function checkUserDeletions(walletAddress) {
  try {
    console.log(`=== Checking Deletions for ${walletAddress} ===\n`);
    
    const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
    
    // Query for deletion markers from this user
    const deletionQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["project-deletion"] },
            { name: "Deleted-By", values: ["${walletAddress}"] }
          ],
          first: 100,
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: deletionQuery }),
    });
    
    const data = await response.json();
    const edges = data?.data?.transactions?.edges || [];
    
    console.log(`Found ${edges.length} deletion markers from this user\n`);
    
    edges.forEach((edge, index) => {
      const tags = {};
      edge.node.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });
      
      console.log(`Deletion ${index + 1}:`);
      console.log(`  Transaction ID: ${edge.node.id}`);
      console.log(`  Project ID: ${tags['Project-ID'] || 'N/A'}`);
      console.log(`  Timestamp: ${new Date(edge.node.timestamp).toLocaleString()}`);
      console.log('  All tags:', JSON.stringify(tags, null, 2));
      console.log('');
    });
    
    // Also check all deletion markers (not just from this user)
    console.log('\n=== All Deletion Markers ===\n');
    
    const allDeletionQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["project-deletion"] }
          ],
          first: 100,
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
    
    const allResponse = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: allDeletionQuery }),
    });
    
    const allData = await allResponse.json();
    const allEdges = allData?.data?.transactions?.edges || [];
    
    console.log(`Total deletion markers in system: ${allEdges.length}`);
    
    if (allEdges.length > 0) {
      console.log('\nAll deletion markers:');
      allEdges.forEach((edge, index) => {
        const tags = {};
        edge.node.tags.forEach(tag => {
          tags[tag.name] = tag.value;
        });
        
        console.log(`${index + 1}. Project: ${tags['Project-ID']}, By: ${tags['Deleted-By']}, Time: ${new Date(edge.node.timestamp).toLocaleString()}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Check for a specific wallet or use a default
const walletAddress = process.argv[2] || '0x0E8FA0F817cD3e70a4bc9C18bEF3d6CaD2C2c738';
checkUserDeletions(walletAddress);
