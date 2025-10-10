const fetch = require('node-fetch');

async function checkFolderDeletions() {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  console.log('=== Checking Recent Deletion Markers ===');
  
  // Query for recent deletion markers
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: deletionQuery })
  });
  
  const data = await response.json();
  
  if (data?.data?.transactions?.edges) {
    console.log(`Found ${data.data.transactions.edges.length} recent deletion markers:\n`);
    
    const projectIds = new Set();
    
    data.data.transactions.edges.forEach((edge, index) => {
      const tags = edge.node.tags.reduce((acc, tag) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      
      const projectId = tags['Project-ID'];
      projectIds.add(projectId);
      
      console.log(`Deletion ${index + 1}:`);
      console.log(`  Transaction ID: ${edge.node.id}`);
      console.log(`  Project-ID: ${projectId}`);
      console.log(`  Deleted-By: ${tags['Deleted-By']}`);
      console.log(`  Deleted-At: ${new Date(parseInt(tags['Deleted-At'])).toISOString()}`);
      console.log('');
    });
    
    // Check if these project IDs look like transaction IDs
    console.log('\n=== Analysis ===');
    const txIdPattern = /^[A-Za-z0-9_-]{43,44}$/; // Base64 pattern for transaction IDs
    const clayIdPattern = /^clay-\d+-[a-z0-9]+$/; // Pattern for clay project IDs
    
    projectIds.forEach(id => {
      if (txIdPattern.test(id)) {
        console.log(`⚠️  ${id} looks like a Transaction ID (should be Project ID)`);
      } else if (clayIdPattern.test(id)) {
        console.log(`✅ ${id} is a valid Project ID`);
      } else {
        console.log(`❓ ${id} has unknown format`);
      }
    });
  }
}

checkFolderDeletions().catch(console.error);
