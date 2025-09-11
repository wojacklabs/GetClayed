async function checkUserProjectList(walletAddress, targetProjectId) {
  try {
    console.log(`=== Checking Projects for User: ${walletAddress} ===\n`);
    console.log(`Looking for project: ${targetProjectId}\n`);
    
    const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
    
    // Query user's projects
    const projectQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Author", values: ["${walletAddress}"] },
            { name: "Data-Type", values: ["clay-project", "clay-project-manifest"] }
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
    
    const response = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: projectQuery }),
    });
    
    const data = await response.json();
    const edges = data?.data?.transactions?.edges || [];
    
    console.log(`Total transactions found: ${edges.length}\n`);
    
    // Group by project ID
    const projectMap = new Map();
    let foundTarget = false;
    
    edges.forEach(edge => {
      const tags = {};
      edge.node.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });
      
      const projectId = tags['Project-ID'] || edge.node.id;
      
      if (projectId === targetProjectId) {
        foundTarget = true;
        console.log(`✅ FOUND TARGET PROJECT:`);
        console.log(`   TX ID: ${edge.node.id}`);
        console.log(`   Name: ${tags['Project-Name']}`);
        console.log(`   Data Type: ${tags['Data-Type']}`);
        console.log(`   Timestamp: ${new Date(edge.node.timestamp).toLocaleString()}`);
        console.log('');
      }
      
      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, {
          id: edge.node.id,
          projectId: projectId,
          name: tags['Project-Name'] || 'Untitled',
          dataType: tags['Data-Type'],
          timestamp: edge.node.timestamp,
          folder: tags['Folder'] || '/'
        });
      }
    });
    
    if (!foundTarget) {
      console.log(`❌ PROJECT ${targetProjectId} NOT FOUND in user's project list\n`);
    }
    
    // List all unique projects
    console.log('All unique projects for this user:');
    const projects = Array.from(projectMap.values());
    projects.sort((a, b) => b.timestamp - a.timestamp);
    
    projects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name} (${project.projectId})`);
      console.log(`   Type: ${project.dataType}, Folder: ${project.folder}`);
    });
    
    // Check deletion markers for this user
    console.log('\n=== Checking Deletion Markers for User ===\n');
    
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
    
    const delResponse = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: deletionQuery }),
    });
    
    const delData = await delResponse.json();
    const delEdges = delData?.data?.transactions?.edges || [];
    
    console.log(`Found ${delEdges.length} deletion markers by this user`);
    
    if (delEdges.length > 0) {
      delEdges.forEach((edge, index) => {
        const tags = {};
        edge.node.tags.forEach(tag => {
          tags[tag.name] = tag.value;
        });
        
        console.log(`${index + 1}. Deleted: ${tags['Project-ID']}`);
        if (tags['Project-ID'] === targetProjectId) {
          console.log(`   ⚠️ THIS IS THE TARGET PROJECT!`);
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Check specific user and project
const walletAddress = '0x0e8fa0f817cd3e70a4bc9c18bef3d6cad2c2c738';
const projectId = 'clay-1757664210558-drde3xg9j';
checkUserProjectList(walletAddress, projectId);
