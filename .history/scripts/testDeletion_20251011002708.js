const fetch = require('node-fetch');

async function testDeletion() {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  // Query for a specific project
  const projectTxId = 'FaNVDsSQuXrwZP44FsjBjWgbnRBBL31x4S9iTcAQbGhz';
  
  console.log('Checking project details...');
  
  // Get project details
  const projectQuery = `
    query {
      transactions(
        ids: ["${projectTxId}"]
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
  
  const projectResponse = await fetch(IRYS_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: projectQuery })
  });
  
  const projectData = await projectResponse.json();
  
  if (projectData?.data?.transactions?.edges?.[0]) {
    const node = projectData.data.transactions.edges[0].node;
    const tags = node.tags.reduce((acc, tag) => {
      acc[tag.name] = tag.value;
      return acc;
    }, {});
    
    console.log('\nProject Details:');
    console.log('Transaction ID:', node.id);
    console.log('Project ID:', tags['Project-ID'] || 'N/A');
    console.log('Project Name:', tags['Project-Name'] || 'N/A');
    console.log('Author:', tags['Author'] || 'N/A');
    
    // Now check for deletion markers for this project ID
    const actualProjectId = tags['Project-ID'];
    if (actualProjectId) {
      console.log('\nChecking for deletion markers for Project ID:', actualProjectId);
      
      const deletionQuery = `
        query {
          transactions(
            tags: [
              { name: "App-Name", values: ["GetClayed"] },
              { name: "Data-Type", values: ["project-deletion"] },
              { name: "Project-ID", values: ["${actualProjectId}"] }
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
      
      const deletionResponse = await fetch(IRYS_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: deletionQuery })
      });
      
      const deletionData = await deletionResponse.json();
      
      if (deletionData?.data?.transactions?.edges?.length > 0) {
        console.log('\nFound deletion markers:');
        deletionData.data.transactions.edges.forEach(edge => {
          const tags = edge.node.tags.reduce((acc, tag) => {
            acc[tag.name] = tag.value;
            return acc;
          }, {});
          console.log(`- ${edge.node.id}: deleted by ${tags['Deleted-By']} at ${new Date(parseInt(tags['Deleted-At'])).toISOString()}`);
        });
      } else {
        console.log('\nNo deletion markers found for this project ID');
      }
    }
  }
}

testDeletion().catch(console.error);
