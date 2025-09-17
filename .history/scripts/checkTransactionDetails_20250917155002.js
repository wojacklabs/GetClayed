#!/usr/bin/env node

const axios = require('axios');

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

async function checkTransactionDetails(txId) {
  try {
    console.log(`=== Transaction Details: ${txId} ===\n`);
    
    // Query specific transaction
    const query = `
      query {
        transactions(
          ids: ["${txId}"]
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
    
    if (!response.data?.data?.transactions?.edges?.[0]) {
      console.error('Transaction not found');
      return;
    }
    
    const tx = response.data.data.transactions.edges[0].node;
    const date = new Date(tx.timestamp);
    
    console.log(`Transaction ID: ${tx.id}`);
    console.log(`Timestamp: ${tx.timestamp}`);
    console.log(`Date: ${date.toLocaleString()}`);
    console.log(`\nAll Tags:`);
    
    tx.tags.forEach(tag => {
      console.log(`  ${tag.name}: ${tag.value}`);
    });
    
  } catch (error) {
    console.error('Error querying Irys:', error.response?.data || error.message);
  }
}

// Get transaction ID from command line argument
const txId = process.argv[2];

if (!txId) {
  console.log('Usage: node scripts/checkTransactionDetails.js <transaction-id>');
  process.exit(1);
}

// Run the check
checkTransactionDetails(txId);
