const axios = require('axios');

async function checkRecentTransactions() {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  console.log('=== Checking Recent GetClayed Transactions ===\n');
  
  // Query without author filter
  const query = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["GetClayed"] }
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
  
  try {
    const response = await axios.post(IRYS_GRAPHQL_URL, {
      query
    });
    
    const edges = response.data?.data?.transactions?.edges || [];
    console.log(`Found ${edges.length} recent transactions\n`);
    
    edges.forEach((edge, index) => {
      const tags = {};
      edge.node.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });
      
      // Convert timestamp to readable date
      let timestamp = edge.node.timestamp;
      let dateStr;
      try {
        dateStr = new Date(timestamp * 1000).toISOString();
      } catch (e) {
        dateStr = `Invalid (${timestamp})`;
      }
      
      console.log(`Transaction ${index + 1}:`);
      console.log(`  ID: ${edge.node.id}`);
      console.log(`  Timestamp: ${dateStr}`);
      console.log(`  Data-Type: ${tags['Data-Type'] || 'N/A'}`);
      console.log(`  Project-Name: ${tags['Project-Name'] || 'N/A'}`);
      console.log(`  Author: ${tags['Author'] || 'N/A'}`);
      
      // Check if this is our manifest
      if (edge.node.id === 'cHEFHW4QVbiSJiEATSqrVzpmiiY8NAUbz7sesspf5qx') {
        console.log('  *** THIS IS OUR MANIFEST ***');
      }
      
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkRecentTransactions();
