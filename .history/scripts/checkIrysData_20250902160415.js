const axios = require('axios');

async function checkIrysData() {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  // 1. Check all GetClayed projects
  console.log('=== Checking all GetClayed projects ===');
  const allProjectsQuery = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["GetClayed"] },
          { name: "Data-Type", values: ["clay-project", "clay-project-manifest"] }
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

  try {
    const response = await axios.post(IRYS_GRAPHQL_URL, {
      query: allProjectsQuery
    });

    const edges = response.data?.data?.transactions?.edges || [];
    console.log(`Found ${edges.length} GetClayed projects\n`);

    edges.forEach((edge, index) => {
      console.log(`\nProject ${index + 1}:`);
      console.log(`ID: ${edge.node.id}`);
      console.log(`Timestamp: ${new Date(edge.node.timestamp * 1000).toISOString()}`);
      
      const tags = edge.node.tags || [];
      const authorTag = tags.find(t => t.name === 'Author');
      const projectNameTag = tags.find(t => t.name === 'Project-Name');
      const dataTypeTag = tags.find(t => t.name === 'Data-Type');
      const rootTxTag = tags.find(t => t.name === 'Root-TX');
      
      console.log(`Author: ${authorTag?.value || 'N/A'}`);
      console.log(`Project Name: ${projectNameTag?.value || 'N/A'}`);
      console.log(`Data Type: ${dataTypeTag?.value || 'N/A'}`);
      console.log(`Root TX: ${rootTxTag?.value || 'N/A'}`);
    });

    // 2. Check specific wallet address (lowercase)
    const walletAddress = '0x0e8fa0f817cd3e70a4bc9c18bef3d6cad2c2c738';
    console.log(`\n\n=== Checking projects for wallet: ${walletAddress} ===`);
    
    const walletProjectsQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["clay-project", "clay-project-manifest"] },
            { name: "Author", values: ["${walletAddress}"] }
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

    const walletResponse = await axios.post(IRYS_GRAPHQL_URL, {
      query: walletProjectsQuery
    });

    const walletEdges = walletResponse.data?.data?.transactions?.edges || [];
    console.log(`Found ${walletEdges.length} projects for this wallet`);

    // 3. Check a specific transaction
    const txId = 'cHEFHW4QVbiSJiEATSqrVzpmiiY8NAUbz7sesspf5qx'; // From the logs
    console.log(`\n\n=== Checking specific transaction: ${txId} ===`);
    
    try {
      const txResponse = await axios.get(`https://gateway.irys.xyz/${txId}`);
      console.log('Transaction found! Data type:', typeof txResponse.data);
      console.log('Data preview:', JSON.stringify(txResponse.data).substring(0, 200) + '...');
    } catch (error) {
      console.log('Error fetching transaction:', error.message);
    }

    // 4. Check transaction metadata
    const txMetadataQuery = `
      query {
        transaction(id: "${txId}") {
          id
          timestamp
          tags {
            name
            value
          }
        }
      }
    `;

    const metadataResponse = await axios.post(IRYS_GRAPHQL_URL, {
      query: txMetadataQuery
    });

    const txData = metadataResponse.data?.data?.transaction;
    if (txData) {
      console.log('\nTransaction metadata:');
      console.log(`ID: ${txData.id}`);
      console.log(`Timestamp: ${new Date(txData.timestamp * 1000).toISOString()}`);
      console.log('Tags:');
      txData.tags.forEach(tag => {
        console.log(`  ${tag.name}: ${tag.value}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

checkIrysData();
