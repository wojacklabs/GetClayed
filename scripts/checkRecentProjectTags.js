async function checkRecentProjectTags() {
  try {
    const url = 'https://uploader.irys.xyz/graphql';
    
    // Query for recent GetClayed projects
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] }
            { name: "Data-Type", values: ["clay-project", "clay-project-manifest"] }
          ]
          first: 5
          order: DESC
        ) {
          edges {
            node {
              id
              timestamp
              owner {
                address
              }
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

    const result = await response.json();
    
    console.log('=== Recent GetClayed Projects ===\n');
    
    if (!result.data?.transactions?.edges || result.data.transactions.edges.length === 0) {
      console.log('No recent projects found.');
      return;
    }

    result.data.transactions.edges.forEach((edge, index) => {
      const node = edge.node;
      const tags = {};
      
      node.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });

      const date = new Date(parseInt(node.timestamp));
      
      console.log(`${index + 1}. Project: ${tags['Project-Name'] || 'N/A'}`);
      console.log(`   ID: ${node.id}`);
      console.log(`   Owner: ${node.owner.address}`);
      console.log(`   Time: ${date.toLocaleString()}`);
      console.log(`   Has Thumbnail-ID: ${tags['Thumbnail-ID'] ? 'YES - ' + tags['Thumbnail-ID'] : 'NO'}`);
      console.log(`   All Tags:`);
      Object.entries(tags).forEach(([key, value]) => {
        console.log(`     ${key}: ${value}`);
      });
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkRecentProjectTags();
