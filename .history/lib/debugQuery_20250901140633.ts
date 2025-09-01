import axios from 'axios';

/**
 * Debug function to query all GetClayed transactions
 */
export async function debugQueryAllProjects() {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  try {
    console.log('[DebugQuery] Querying all GetClayed transactions...');
    
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] }
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
    
    const response = await axios.post(IRYS_GRAPHQL_URL, { 
      query 
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (response.data?.data?.transactions?.edges) {
      const edges = response.data.data.transactions.edges;
      console.log(`[DebugQuery] Found ${edges.length} GetClayed transactions`);
      
      edges.forEach((edge: any, index: number) => {
        console.log(`\n[DebugQuery] Transaction ${index + 1}:`, edge.node.id);
        const tags: Record<string, string> = {};
        edge.node.tags.forEach((tag: any) => {
          tags[tag.name] = tag.value;
        });
        console.log('[DebugQuery] Tags:', tags);
      });
    } else {
      console.log('[DebugQuery] No transactions found');
    }
    
    return response.data;
  } catch (error) {
    console.error('[DebugQuery] Error:', error);
    throw error;
  }
}

// Make it available in browser console
if (typeof window !== 'undefined') {
  (window as any).debugQueryAllProjects = debugQueryAllProjects;
}
