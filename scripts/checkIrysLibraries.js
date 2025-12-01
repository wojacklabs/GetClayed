const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';

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
    
    console.log('=' .repeat(60));
    console.log('IRYS Library Registrations (Metadata)');
    console.log('=' .repeat(60));
    console.log('Found', edges.length, 'registration transactions\n');
    
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
        console.log(`   Timestamp: ${tags['Registered-At']}`);
        console.log('');
      }
    });
    
    console.log('=' .repeat(60));
    console.log('IMPORTANT:');
    console.log('=' .repeat(60));
    console.log('Irys stores METADATA (names, descriptions)');
    console.log('Contract stores OWNERSHIP and ROYALTY data');
    console.log('');
    console.log('queryLibraryAssets() fetches from Irys FIRST,');
    console.log('then queries the CONTRACT for current state');
    console.log('');
    console.log('If different libraries appear on different pages,');
    console.log('they might be using different LIBRARY_CONTRACT_ADDRESS!');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkIrysLibraries();

<<<<<<< Updated upstream







=======
>>>>>>> Stashed changes


