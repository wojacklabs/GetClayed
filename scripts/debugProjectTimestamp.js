#!/usr/bin/env node

const axios = require('axios');

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

async function debugProjectTimestamp() {
  try {
    const walletAddress = '0x0e8fa0f817cd3e70a4bc9c18bef3d6cad2c2c738';
    console.log(`=== Debugging Project Timestamps for Wallet: ${walletAddress} ===\n`);
    
    // Query projects
    const projectQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["clay-project", "clay-project-manifest"] },
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
      query: projectQuery 
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
    console.log(`Found ${transactions.length} transactions\n`);
    
    transactions.forEach((edge, index) => {
      const tx = edge.node;
      const tags = {};
      tx.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });
      
      const projectName = tags['Project-Name'] || 'N/A';
      const createdAt = tags['Created-At'];
      
      console.log(`${index + 1}. Project: ${projectName}`);
      console.log(`   Node timestamp: ${tx.timestamp}`);
      console.log(`   Node date: ${new Date(tx.timestamp).toLocaleString()}`);
      console.log(`   Created-At tag: ${createdAt || 'N/A'}`);
      
      if (createdAt) {
        const parsedDate = new Date(createdAt);
        console.log(`   Parsed date: ${parsedDate.toLocaleString()}`);
        console.log(`   Parsed timestamp: ${parsedDate.getTime()}`);
        console.log(`   Is valid: ${!isNaN(parsedDate.getTime())}`);
      }
      
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

debugProjectTimestamp();
