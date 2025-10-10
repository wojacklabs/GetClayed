// No need for dotenv in this script

async function checkDeletionMarkers() {
  try {
    console.log('=== Checking Deletion Markers ===\n');
    
    const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
    
    // Query for deletion markers
    const deletionQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["project-deletion"] }
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
      body: JSON.stringify({ query: deletionQuery }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const edges = data?.data?.transactions?.edges || [];
    
    console.log(`Found ${edges.length} deletion markers\n`);
    
    edges.forEach((edge, index) => {
      const tags = {};
      edge.node.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });
      
      console.log(`Deletion ${index + 1}:`);
      console.log(`  Transaction ID: ${edge.node.id}`);
      console.log(`  Project ID: ${tags['Project-ID'] || 'N/A'}`);
      console.log(`  Deleted By: ${tags['Deleted-By'] || 'N/A'}`);
      console.log(`  Timestamp: ${new Date(edge.node.timestamp).toLocaleString()}`);
      console.log('');
    });
    
    // Now query for all projects to see which ones should be filtered
    console.log('\n=== Checking All Projects ===\n');
    
    const projectQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["clay-project", "clay-project-manifest"] }
          ],
          first: 50,
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: projectQuery }),
    });
    
    const projectData = await projectResponse.json();
    const projectEdges = projectData?.data?.transactions?.edges || [];
    
    // Extract deleted project IDs
    const deletedProjectIds = new Set();
    edges.forEach(edge => {
      const tags = {};
      edge.node.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });
      if (tags['Project-ID']) {
        deletedProjectIds.add(tags['Project-ID']);
      }
    });
    
    console.log(`Total projects found: ${projectEdges.length}`);
    console.log(`Deleted project IDs: ${Array.from(deletedProjectIds).join(', ')}\n`);
    
    // Check which projects should be filtered
    let visibleCount = 0;
    let deletedCount = 0;
    
    projectEdges.forEach(edge => {
      const tags = {};
      edge.node.tags.forEach(tag => {
        tags[tag.name] = tag.value;
      });
      
      const projectId = tags['Project-ID'] || edge.node.id;
      const isDeleted = deletedProjectIds.has(projectId);
      
      if (isDeleted) {
        deletedCount++;
        console.log(`[DELETED] ${tags['Project-Name']} (${projectId})`);
      } else {
        visibleCount++;
        console.log(`[VISIBLE] ${tags['Project-Name']} (${projectId})`);
      }
    });
    
    console.log(`\n--- Summary ---`);
    console.log(`Visible projects: ${visibleCount}`);
    console.log(`Deleted projects that should be hidden: ${deletedCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDeletionMarkers();
