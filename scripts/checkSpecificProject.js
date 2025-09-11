async function checkSpecificProject(projectId) {
  try {
    console.log(`=== Checking Project: ${projectId} ===\n`);
    
    const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
    
    // 1. Check if this project exists
    const projectQuery = `
      query {
        transactions(
          ids: ["${projectId}"],
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
    
    const response = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: projectQuery }),
    });
    
    const data = await response.json();
    const edges = data?.data?.transactions?.edges || [];
    
    if (edges.length === 0) {
      console.log('Project not found!');
      return;
    }
    
    const projectNode = edges[0].node;
    const tags = {};
    projectNode.tags.forEach(tag => {
      tags[tag.name] = tag.value;
    });
    
    console.log('Project found:');
    console.log(`  Transaction ID: ${projectNode.id}`);
    console.log(`  Project ID: ${tags['Project-ID'] || 'N/A'}`);
    console.log(`  Name: ${tags['Project-Name'] || 'N/A'}`);
    console.log(`  Author: ${tags['Author'] || 'N/A'}`);
    console.log(`  Data Type: ${tags['Data-Type'] || 'N/A'}`);
    console.log(`  Folder: ${tags['Folder'] || '/'}`);
    console.log(`  Timestamp: ${new Date(projectNode.timestamp).toLocaleString()}`);
    console.log('\nAll tags:');
    console.log(JSON.stringify(tags, null, 2));
    
    // 2. Check for deletion markers for this project
    console.log('\n=== Checking Deletion Markers ===\n');
    
    const actualProjectId = tags['Project-ID'] || projectId;
    
    const deletionQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["project-deletion"] },
            { name: "Project-ID", values: ["${actualProjectId}"] }
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
    
    const deletionResponse = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: deletionQuery }),
    });
    
    const deletionData = await deletionResponse.json();
    const deletionEdges = deletionData?.data?.transactions?.edges || [];
    
    console.log(`Found ${deletionEdges.length} deletion markers for this project`);
    
    if (deletionEdges.length > 0) {
      deletionEdges.forEach((edge, index) => {
        const delTags = {};
        edge.node.tags.forEach(tag => {
          delTags[tag.name] = tag.value;
        });
        
        console.log(`\nDeletion ${index + 1}:`);
        console.log(`  Deletion TX: ${edge.node.id}`);
        console.log(`  Deleted By: ${delTags['Deleted-By']}`);
        console.log(`  Deleted At: ${new Date(parseInt(delTags['Deleted-At'])).toLocaleString()}`);
      });
    }
    
    // 3. Check other versions of this project
    console.log('\n=== Checking Other Versions ===\n');
    
    const versionsQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Project-ID", values: ["${actualProjectId}"] }
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
    
    const versionsResponse = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: versionsQuery }),
    });
    
    const versionsData = await versionsResponse.json();
    const versionEdges = versionsData?.data?.transactions?.edges || [];
    
    console.log(`Found ${versionEdges.length} total transactions for this project`);
    
    versionEdges.forEach((edge, index) => {
      const vTags = {};
      edge.node.tags.forEach(tag => {
        vTags[tag.name] = tag.value;
      });
      
      console.log(`\nVersion ${index + 1}:`);
      console.log(`  TX ID: ${edge.node.id}`);
      console.log(`  Data Type: ${vTags['Data-Type']}`);
      console.log(`  Timestamp: ${new Date(edge.node.timestamp).toLocaleString()}`);
      console.log(`  Is Root: ${vTags['Root-TX'] ? 'No (Root: ' + vTags['Root-TX'] + ')' : 'Yes'}`);
    });
    
    // 4. Summary
    console.log('\n=== Summary ===\n');
    console.log(`Project Author: ${tags['Author']}`);
    console.log(`Has deletion markers: ${deletionEdges.length > 0 ? 'Yes' : 'No'}`);
    console.log(`Should be visible in home: ${deletionEdges.length === 0 ? 'Yes' : 'No'}`);
    console.log(`Should be visible in profile for ${tags['Author']}: ${deletionEdges.length === 0 ? 'Yes' : 'No'}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Get project ID from command line or use the one provided
const projectId = process.argv[2] || 'EEtP9SnfTQBZwpWdPEDuGz5ZvJifMT69K6nGz6tHHXbv';
checkSpecificProject(projectId);
