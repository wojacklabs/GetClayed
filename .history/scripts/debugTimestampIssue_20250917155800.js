#!/usr/bin/env node

const axios = require('axios');

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

async function debugTimestampIssue() {
  try {
    const walletAddress = '0x0e8fa0f817cd3e70a4bc9c18bef3d6cad2c2c738';
    console.log(`=== Debugging Timestamp Issue for Wallet: ${walletAddress} ===\n`);
    
    // Query all manifest transactions
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["clay-project-manifest"] },
            { name: "Author", values: ["${walletAddress.toLowerCase()}"] }
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
    
    const response = await axios.post(IRYS_GRAPHQL_URL, { 
      query: query 
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.data?.data?.transactions?.edges) {
      console.error('No transactions found');
      return;
    }
    
    const transactions = response.data.data.transactions.edges;
    console.log(`Found ${transactions.length} manifest transactions\n`);
    
    // Problematic projects
    const problematicProjects = ['post123', 'test88', 'test04', 'uhuhuhuhuhu', '911'];
    
    transactions.forEach((edge) => {
      const tx = edge.node;
      const tags = {};
      tx.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });
      
      const projectName = tags['Project-Name'] || 'N/A';
      
      if (problematicProjects.includes(projectName)) {
        console.log(`Project: ${projectName}`);
        console.log(`  TX ID: ${tx.id}`);
        console.log(`  Raw timestamp: ${tx.timestamp}`);
        console.log(`  Date: ${new Date(tx.timestamp).toLocaleString()}`);
        console.log(`  Project-ID: ${tags['Project-ID'] || 'N/A'}`);
        console.log(`  Created-At tag: ${tags['Created-At'] || 'N/A'}`);
        console.log(`  Updated-At tag: ${tags['Updated-At'] || 'N/A'}`);
        console.log('');
      }
    });
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

debugTimestampIssue();
