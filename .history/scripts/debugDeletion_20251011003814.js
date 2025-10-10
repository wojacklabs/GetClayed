const fetch = require('node-fetch');

async function debugDeletion() {
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
        first: 5,
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
    
    data.data.transactions.edges.forEach((edge, index) => {
      const tags = edge.node.tags.reduce((acc, tag) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      
      console.log(`Deletion ${index + 1}:`);
      console.log(`  Transaction ID: ${edge.node.id}`);
      console.log(`  Project-ID: ${tags['Project-ID']}`);
      console.log(`  Deleted-By: ${tags['Deleted-By']}`);
      console.log(`  Deleted-At: ${new Date(parseInt(tags['Deleted-At'])).toISOString()}`);
      console.log('');
    });
  }
  
  // Now check for the specific project
  console.log('=== Checking Specific Project (hohoho) ===');
  
  const projectQuery = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["GetClayed"] },
          { name: "Project-ID", values: ["clay-1756705217991-ik26t2x46"] }
        ],
        first: 10,
        order: DESC
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
  
  const projectResponse = await fetch(IRYS_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: projectQuery })
  });
  
  const projectData = await projectResponse.json();
  
  if (projectData?.data?.transactions?.edges) {
    console.log(`Found ${projectData.data.transactions.edges.length} transactions for this project:`);
    projectData.data.transactions.edges.forEach((edge, index) => {
      const tags = edge.node.tags.reduce((acc, tag) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      console.log(`${index + 1}. TX: ${edge.node.id}, Type: ${tags['Data-Type']}`);
    });
  }
}

debugDeletion().catch(console.error);
