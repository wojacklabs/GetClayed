async function checkDeletionTags() {
  try {
    console.log('=== Checking All Deletion Marker Tags ===\n');
    
    const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
    
    const deletionQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["project-deletion"] }
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: deletionQuery }),
    });
    
    const data = await response.json();
    const edges = data?.data?.transactions?.edges || [];
    
    console.log(`Found ${edges.length} deletion markers\n`);
    
    edges.forEach((edge, index) => {
      console.log(`Deletion ${index + 1}: TX ${edge.node.id}`);
      console.log('Tags:');
      edge.node.tags.forEach(tag => {
        console.log(`  ${tag.name}: ${tag.value}`);
      });
      console.log('');
    });
    
    // Now check with Deleted-By filter
    console.log('\n=== User-specific Query ===\n');
    
    const userQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["project-deletion"] },
            { name: "Deleted-By", values: ["0x0e8fa0f817cd3e70a4bc9c18bef3d6cad2c2c738"] }
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
    
    const userResponse = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: userQuery }),
    });
    
    const userData = await userResponse.json();
    const userEdges = userData?.data?.transactions?.edges || [];
    
    console.log(`Found ${userEdges.length} deletion markers from user 0x0e8fa0f817cd3e70a4bc9c18bef3d6cad2c2c738`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDeletionTags();
