#!/usr/bin/env node

const axios = require('axios');

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

async function debugRecentUploads() {
  try {
    console.log('=== Debugging Recent GetClayed Uploads ===\n');
    
    // Query recent uploads with GetClayed app name
    const recentQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] }
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
    
    const response = await axios.post(IRYS_GRAPHQL_URL, { 
      query: recentQuery 
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
    console.log(`Found ${transactions.length} recent GetClayed transactions:\n`);
    
    transactions.forEach((edge, index) => {
      const tx = edge.node;
      const tags = {};
      tx.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });
      
      const date = new Date(tx.timestamp);
      console.log(`${index + 1}. Transaction: ${tx.id}`);
      console.log(`   Time: ${date.toLocaleString()}`);
      console.log(`   Data-Type: ${tags['Data-Type'] || 'N/A'}`);
      console.log(`   Author: ${tags['Author'] || 'N/A'}`);
      console.log(`   Project-Name: ${tags['Project-Name'] || 'N/A'}`);
      console.log(`   Project-ID: ${tags['Project-ID'] || 'N/A'}`);
      
      // Show all tags for debugging
      console.log('   All Tags:');
      tx.tags.forEach(tag => {
        console.log(`     ${tag.name}: ${tag.value}`);
      });
      console.log('');
    });
    
  } catch (error) {
    console.error('Error querying Irys:', error.response?.data || error.message);
  }
}

// Run the debug function
debugRecentUploads();
