const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql'\;

async function checkIrysLibraries() {
  try {
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["library-registration"] }
          ],
          first: 20,
          order: DESC
        ) {
          edges {
            node {
              id
              tags {
                name
                value
              }
            }
          }
        }
      }
    `;
    
    const response = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    const result = await response.json();
    const edges = result.data?.transactions?.edges || [];
    
    console.log('Found', edges.length, 'library registrations on Irys:\n');
    
    const seen = new Set();
    edges.forEach((edge, idx) => {
      const tags = edge.node.tags.reduce((acc, tag) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      
      const projectId = tags['Project-ID'];
      if (!seen.has(projectId)) {
        seen.add(projectId);
        console.log(`${seen.size}. ${tags['Asset-Name']}`);
        console.log(`   Project-ID: ${projectId}`);
        console.log(`   Registered-By: ${tags['Registered-By']}`);
        console.log('');
      }
    });
    
    console.log('\nThese are ALL libraries registered on Irys');
    console.log('The contract address filters are applied AFTER fetching from Irys');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkIrysLibraries();
