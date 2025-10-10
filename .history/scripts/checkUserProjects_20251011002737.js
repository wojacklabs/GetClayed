const fetch = require('node-fetch');

async function checkUserProjects() {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  const walletAddress = '0x0e8fa0f817cd3e70a4bc9c18bef3d6cad2c2c738';
  
  console.log(`Checking projects for user: ${walletAddress}`);
  
  // First check deletion markers
  const deletionQuery = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["GetClayed"] },
          { name: "Data-Type", values: ["project-deletion"] },
          { name: "Deleted-By", values: ["${walletAddress}"] }
        ],
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
  
  const deletionResponse = await fetch(IRYS_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: deletionQuery })
  });
  
  const deletionData = await deletionResponse.json();
  const deletedProjectIds = new Set();
  
  if (deletionData?.data?.transactions?.edges) {
    console.log(`\nFound ${deletionData.data.transactions.edges.length} deletion markers:`);
    deletionData.data.transactions.edges.forEach(edge => {
      const tags = edge.node.tags.reduce((acc, tag) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      if (tags['Project-ID']) {
        deletedProjectIds.add(tags['Project-ID']);
        console.log(`- ${tags['Project-ID']} deleted at ${new Date(parseInt(tags['Deleted-At'])).toISOString()}`);
      }
    });
  }
  
  // Then check projects
  const projectQuery = `
    query {
      transactions(
        tags: [
          { name: "App-Name", values: ["GetClayed"] },
          { name: "Data-Type", values: ["clay-project", "clay-project-manifest"] },
          { name: "Author", values: ["${walletAddress}"] }
        ],
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
  
  const projectResponse = await fetch(IRYS_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: projectQuery })
  });
  
  const projectData = await projectResponse.json();
  
  if (projectData?.data?.transactions?.edges) {
    console.log(`\nFound ${projectData.data.transactions.edges.length} total projects`);
    
    const activeProjects = [];
    projectData.data.transactions.edges.forEach(edge => {
      const tags = edge.node.tags.reduce((acc, tag) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      
      const projectId = tags['Project-ID'] || edge.node.id;
      
      if (!deletedProjectIds.has(projectId)) {
        activeProjects.push({
          txId: edge.node.id,
          projectId: projectId,
          name: tags['Project-Name'] || 'Untitled',
          isDeleted: false
        });
      }
    });
    
    console.log(`\nActive projects (${activeProjects.length}):`);
    activeProjects.forEach(p => {
      console.log(`- ${p.name} (ID: ${p.projectId}, TX: ${p.txId})`);
    });
  }
}

checkUserProjects().catch(console.error);