const axios = require('axios');

async function checkManifest() {
  const manifestId = 'cHEFHW4QVbiSJiEATSqrVzpmiiY8NAUbz7sesspf5qx';
  
  console.log(`=== Checking Manifest: ${manifestId} ===\n`);
  
  // 1. Get manifest metadata
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  const query = `
    query {
      transactions(
        ids: ["${manifestId}"],
        first: 1
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
    
    const edge = response.data?.data?.transactions?.edges?.[0];
    if (edge) {
      console.log('Manifest found in GraphQL!');
      console.log('Tags:');
      edge.node.tags.forEach(tag => {
        console.log(`  ${tag.name}: ${tag.value}`);
      });
      
      // Check author case
      const authorTag = edge.node.tags.find(t => t.name === 'Author');
      if (authorTag) {
        console.log(`\nAuthor tag value: "${authorTag.value}"`);
        console.log(`Is lowercase: ${authorTag.value === authorTag.value.toLowerCase()}`);
        console.log(`Lowercase version: "${authorTag.value.toLowerCase()}"`);
      }
    } else {
      console.log('Manifest not found in GraphQL query');
    }
    
    // 2. Get manifest content
    console.log('\n=== Manifest Content ===');
    const contentResponse = await axios.get(`https://gateway.irys.xyz/${manifestId}`);
    console.log('Content:', JSON.stringify(contentResponse.data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkManifest();
