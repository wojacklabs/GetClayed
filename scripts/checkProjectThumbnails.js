// Using fetch API to query Irys GraphQL directly

async function queryProjectThumbnails(walletAddress) {
  try {
    const url = 'https://uploader.irys.xyz/graphql';
    
    // Query for project thumbnails
    const query = `
      query {
        transactions(
          owners: ["${walletAddress}"]
          tags: [
            { name: "App-Name", values: ["GetClayed"] }
            { name: "Data-Type", values: ["project-thumbnail"] }
          ]
          first: 100
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

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const responseText = await response.text();
    console.log('Response status:', response.status);
    
    if (!responseText) {
      console.log('Empty response from server');
      return;
    }
    
    const result = JSON.parse(responseText);
    
    console.log('=== Project Thumbnails for Wallet:', walletAddress, '===\n');
    
    if (!result.data?.transactions?.edges || result.data.transactions.edges.length === 0) {
      console.log('No thumbnails found for this wallet.');
      return;
    }

    console.log(`Found ${result.data.transactions.edges.length} thumbnail(s):\n`);

    result.data.transactions.edges.forEach((edge, index) => {
      const node = edge.node;
      const tags = {};
      
      node.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });

      const date = new Date(parseInt(node.timestamp));
      
      console.log(`${index + 1}. Thumbnail ID: ${node.id}`);
      console.log(`   Uploaded: ${date.toLocaleString()}`);
      console.log(`   Project-ID: ${tags['Project-ID'] || 'N/A'}`);
      console.log(`   Content-Type: ${tags['Content-Type'] || 'N/A'}`);
      console.log(`   View URL: https://gateway.irys.xyz/${node.id}`);
      console.log('');
    });

    // Now check which projects have thumbnails
    console.log('\n=== Checking Projects with Thumbnail-ID tag ===\n');
    
    const projectQuery = `
      query {
        transactions(
          owners: ["${walletAddress}"]
          tags: [
            { name: "App-Name", values: ["GetClayed"] }
            { name: "Data-Type", values: ["clay-project", "clay-project-manifest"] }
          ]
          first: 100
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

    const projectResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: projectQuery }),
    });

    const projectResult = await projectResponse.json();
    
    let projectsWithThumbnails = 0;
    
    if (projectResult.data?.transactions?.edges) {
      projectResult.data.transactions.edges.forEach((edge) => {
        const tags = {};
        edge.node.tags.forEach(tag => {
          tags[tag.name] = tag.value;
        });
        
        if (tags['Thumbnail-ID']) {
          projectsWithThumbnails++;
          console.log(`Project: ${tags['Project-Name']} (${edge.node.id})`);
          console.log(`  Has Thumbnail-ID: ${tags['Thumbnail-ID']}`);
          console.log('');
        }
      });
    }
    
    console.log(`\nTotal projects with thumbnails: ${projectsWithThumbnails}`);

  } catch (error) {
    console.error('Error querying thumbnails:', error);
  }
}

// Get wallet address from command line
const walletAddress = process.argv[2];

if (!walletAddress) {
  console.log('Usage: node scripts/checkProjectThumbnails.js <wallet-address>');
  console.log('Example: node scripts/checkProjectThumbnails.js 0x1234...');
  process.exit(1);
}

queryProjectThumbnails(walletAddress);
