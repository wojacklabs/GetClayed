const axios = require('axios');

async function testQueryProjects() {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  const walletAddress = '0x0e8fa0f817cd3e70a4bc9c18bef3d6cad2c2c738';
  
  console.log('=== Testing Project Query ===');
  console.log(`Wallet: ${walletAddress}`);
  
  // Query exactly like the app does
  const projectTags = [
    { name: 'App-Name', values: ['GetClayed'] },
    { name: 'Data-Type', values: ['clay-project', 'clay-project-manifest'] },
    { name: 'Author', values: [walletAddress.toLowerCase()] }
  ];
  
  const projectQuery = `
    query {
      transactions(
        tags: [${projectTags.map(tag => 
          `{ name: "${tag.name}", values: ${JSON.stringify(tag.values)} }`
        ).join(', ')}],
        first: 100,
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
  
  console.log('\nQuery:', projectQuery);
  
  try {
    const response = await axios.post(IRYS_GRAPHQL_URL, { 
      query: projectQuery 
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const edges = response.data?.data?.transactions?.edges || [];
    console.log(`\nFound ${edges.length} results\n`);
    
    edges.forEach((edge, index) => {
      const tags = {};
      edge.node.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });
      
      console.log(`Result ${index + 1}:`);
      console.log(`  ID: ${edge.node.id}`);
      console.log(`  Data-Type: ${tags['Data-Type']}`);
      console.log(`  Project-ID: ${tags['Project-ID']}`);
      console.log(`  Project-Name: ${tags['Project-Name']}`);
      console.log(`  Author: ${tags['Author']}`);
      console.log(`  Timestamp: ${new Date(edge.node.timestamp * 1000).toISOString()}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testQueryProjects();
