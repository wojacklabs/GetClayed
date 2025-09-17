#!/usr/bin/env node

const axios = require('axios');

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

async function checkUserProjects(walletAddress) {
  try {
    console.log(`=== Checking Projects for Wallet: ${walletAddress} ===\n`);
    
    // Query projects by Author tag
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
    console.log(`Found ${transactions.length} project transactions for this wallet:\n`);
    
    if (transactions.length === 0) {
      console.log('No projects found for this wallet address.');
      console.log('\nLet\'s check if there are any projects without the Author tag...\n');
      
      // Query without Author filter
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
      
      const allResponse = await axios.post(IRYS_GRAPHQL_URL, { 
        query: allProjectsQuery 
      }, {
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (allResponse.data?.data?.transactions?.edges) {
        const allTxs = allResponse.data.data.transactions.edges;
        console.log(`Found ${allTxs.length} total project transactions (all users):\n`);
        
        allTxs.forEach((edge, index) => {
          const tx = edge.node;
          const tags = {};
          tx.tags.forEach(tag => {
            tags[tag.name] = tag.value;
          });
          
          const date = new Date(tx.timestamp);
          console.log(`${index + 1}. Transaction: ${tx.id}`);
          console.log(`   Time: ${date.toLocaleString()}`);
          console.log(`   Author: ${tags['Author'] || 'NO AUTHOR TAG'}`);
          console.log(`   Project-Name: ${tags['Project-Name'] || 'N/A'}`);
          console.log('');
        });
      }
    } else {
      transactions.forEach((edge, index) => {
        const tx = edge.node;
        const tags = {};
        tx.tags.forEach(tag => {
          tags[tag.name] = tag.value;
        });
        
        const date = new Date(tx.timestamp);
        console.log(`${index + 1}. Transaction: ${tx.id}`);
        console.log(`   Time: ${date.toLocaleString()}`);
        console.log(`   Project-Name: ${tags['Project-Name'] || 'N/A'}`);
        console.log(`   Data-Type: ${tags['Data-Type']}`);
        console.log(`   Root-TX: ${tags['Root-TX'] || 'N/A'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error querying Irys:', error.response?.data || error.message);
  }
}

// Get wallet address from command line argument
const walletAddress = process.argv[2];

if (!walletAddress) {
  console.log('Usage: node scripts/checkUserProjects.js <wallet-address>');
  console.log('Example: node scripts/checkUserProjects.js 0x1234...');
  process.exit(1);
}

// Run the check
checkUserProjects(walletAddress);
