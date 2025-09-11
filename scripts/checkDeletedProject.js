async function checkDeletedProject(projectId) {
  try {
    console.log(`=== Checking Deletion Status for Project: ${projectId} ===\n`);
    
    const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
    
    // Check all deletion markers
    const deletionQuery = `
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
    
    const response = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: deletionQuery }),
    });
    
    const data = await response.json();
    const edges = data?.data?.transactions?.edges || [];
    
    console.log(`Total deletion markers found: ${edges.length}\n`);
    
    // Check if our project is in the deletion list
    let foundDeletion = false;
    edges.forEach((edge, index) => {
      const tags = {};
      edge.node.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });
      
      console.log(`${index + 1}. Project-ID: ${tags['Project-ID']}, TX: ${edge.node.id.substring(0, 10)}...`);
      
      if (tags['Project-ID'] === projectId) {
        foundDeletion = true;
        console.log(`   ✅ THIS PROJECT IS MARKED AS DELETED!`);
        console.log(`   Deleted by: ${tags['Deleted-By']}`);
        console.log(`   Deleted at: ${new Date(parseInt(tags['Deleted-At'])).toLocaleString()}`);
      }
    });
    
    if (!foundDeletion) {
      console.log(`\n❌ Project ${projectId} is NOT marked as deleted`);
    }
    
    // Check user queries vs all queries
    console.log('\n=== Comparing Query Methods ===\n');
    
    // User query simulation
    const userQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Author", values: ["0x0e8fa0f817cd3e70a4bc9c18bef3d6cad2c2c738"] },
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
    
    const userResponse = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: userQuery }),
    });
    
    const userData = await userResponse.json();
    const userEdges = userData?.data?.transactions?.edges || [];
    
    console.log(`User-specific deletion markers: ${userEdges.length}`);
    console.log(`All deletion markers: ${edges.length}`);
    console.log(`\nDifference: User query finds ${userEdges.length - edges.length} more/less deletions`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Check the recently deleted project
const projectId = process.argv[2] || 'clay-1757756868055-q1u0o7ebp'; // FaNVDsSQuXrwZP44FsjBjWgbnRBBL31x4S9iTcAQbGhz
checkDeletedProject(projectId);
