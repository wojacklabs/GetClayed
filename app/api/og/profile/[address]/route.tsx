import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Helper to shorten address
function shortenAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Check if string is a valid wallet address
function isWalletAddress(str: string): boolean {
  return str.startsWith('0x') && str.length === 42;
}

// Find user by display name
async function findUserByDisplayName(displayName: string): Promise<string | null> {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  try {
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["user-profile"] }
          ],
          first: 100,
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
    
    // Group by wallet and get latest
    const profileMap = new Map<string, string>();
    
    for (const edge of edges) {
      const tags = edge.node.tags.reduce((acc: any, tag: any) => {
        acc[tag.name] = tag.value;
        return acc;
      }, {});
      
      const walletAddress = tags['Wallet-Address'];
      if (walletAddress && !profileMap.has(walletAddress)) {
        profileMap.set(walletAddress, edge.node.id);
      }
    }
    
    // Check each profile for matching display name
    for (const [wallet, txId] of profileMap) {
      try {
        const dataResponse = await fetch(`https://uploader.irys.xyz/tx/${txId}/data`);
        if (dataResponse.ok) {
          const text = await dataResponse.text();
          const data = JSON.parse(text);
          
          // Handle chunked profiles
          let profile = data;
          if (data.chunkSetId && data.totalChunks && data.chunks) {
            const chunks: string[] = [];
            for (const chunkId of data.chunks) {
              const chunkResponse = await fetch(`https://uploader.irys.xyz/tx/${chunkId}/data`);
              const chunkData = await chunkResponse.json();
              chunks.push(chunkData.chunk);
            }
            profile = JSON.parse(chunks.join(''));
          }
          
          if (profile?.displayName?.toLowerCase() === displayName.toLowerCase()) {
            return wallet;
          }
        }
      } catch (error) {
        console.error(`[Profile OG] Failed to check profile for ${wallet}:`, error);
      }
    }
    
    return null;
  } catch (error) {
    console.error('[Profile OG] Error finding user by display name:', error);
    return null;
  }
}

// Fetch user profile from Irys
async function fetchUserProfile(walletAddress: string) {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  try {
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["user-profile"] },
            { name: "Wallet-Address", values: ["${walletAddress.toLowerCase()}"] }
          ],
          first: 1,
          order: DESC
        ) {
          edges {
            node {
              id
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
    
    if (result.data?.transactions?.edges?.length > 0) {
      const txId = result.data.transactions.edges[0].node.id;
      const dataResponse = await fetch(`https://uploader.irys.xyz/tx/${txId}/data`);
      
      if (dataResponse.ok) {
        const text = await dataResponse.text();
        const data = JSON.parse(text);
        
        // Check if it's a chunk manifest
        if (data.chunkSetId && data.totalChunks && data.chunks) {
          // Download chunks and reconstruct
          const chunks: string[] = [];
          for (const chunkId of data.chunks) {
            const chunkResponse = await fetch(`https://uploader.irys.xyz/tx/${chunkId}/data`);
            const chunkData = await chunkResponse.json();
            chunks.push(chunkData.chunk);
          }
          return JSON.parse(chunks.join(''));
        }
        
        return data;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[Profile OG] Error fetching profile:', error);
    return null;
  }
}

// Fetch user's project count (excluding deleted)
async function fetchProjectCount(walletAddress: string): Promise<number> {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  try {
    // Get all projects
    const projectQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["clay-project", "chunk-manifest"] },
            { name: "Author", values: ["${walletAddress.toLowerCase()}"] }
          ],
          first: 1000,
          order: DESC
        ) {
          edges {
            node {
              tags {
                name
                value
              }
            }
          }
        }
      }
    `;
    
    // Get deleted projects
    const deleteQuery = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["project-deletion"] }
          ],
          first: 1000
        ) {
          edges {
            node {
              tags {
                name
                value
              }
            }
          }
        }
      }
    `;
    
    const [projectResponse, deleteResponse] = await Promise.all([
      fetch(IRYS_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: projectQuery })
      }),
      fetch(IRYS_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: deleteQuery })
      })
    ]);
    
    const [projectResult, deleteResult] = await Promise.all([
      projectResponse.json(),
      deleteResponse.json()
    ]);
    
    const projectEdges = projectResult.data?.transactions?.edges || [];
    const deleteEdges = deleteResult.data?.transactions?.edges || [];
    
    // Get deleted project IDs
    const deletedIds = new Set<string>();
    for (const edge of deleteEdges) {
      const projectId = edge.node.tags.find((t: any) => t.name === 'Project-ID')?.value;
      if (projectId) deletedIds.add(projectId);
    }
    
    // Get unique project IDs (excluding deleted)
    const projectIds = new Set<string>();
    for (const edge of projectEdges) {
      const projectId = edge.node.tags.find((t: any) => t.name === 'Project-ID')?.value;
      if (projectId && !deletedIds.has(projectId)) {
        projectIds.add(projectId);
      }
    }
    
    return projectIds.size;
  } catch (error) {
    console.error('[Profile OG] Error fetching projects:', error);
    return 0;
  }
}

// Fetch follower count
async function fetchFollowerCount(walletAddress: string): Promise<number> {
  const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
  
  try {
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["user-follow"] },
            { name: "Following-Address", values: ["${walletAddress.toLowerCase()}"] }
          ],
          order: ASC,
          first: 100
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

    // Track follow/unfollow actions
    const followerMap = new Map<string, { timestamp: number; action: 'follow' | 'unfollow' }>();

    for (const edge of edges) {
      const tags = edge.node.tags;
      const followerAddress = tags.find((tag: any) => tag.name === 'Follower-Address')?.value;
      const action = tags.find((tag: any) => tag.name === 'Follow-Action')?.value;
      const timestamp = parseInt(tags.find((tag: any) => tag.name === 'Timestamp')?.value || '0');

      if (followerAddress && action) {
        const existing = followerMap.get(followerAddress);
        if (!existing || existing.timestamp < timestamp) {
          followerMap.set(followerAddress, { timestamp, action });
        }
      }
    }

    // Return count of users that are currently followers
    return Array.from(followerMap.values()).filter(data => data.action === 'follow').length;
  } catch (error) {
    console.error('[Profile OG] Error fetching followers:', error);
    return 0;
  }
}

// Generate fallback image for unknown users
function generateFallbackImage(name: string) {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Left side - Text content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '60px 40px 60px 60px',
          }}
        >
          <div
            style={{
              fontSize: '56px',
              fontWeight: '700',
              color: 'white',
              marginBottom: '16px',
              letterSpacing: '-0.02em',
            }}
          >
            {name}
          </div>
          
          <div
            style={{
              fontSize: '20px',
              color: 'rgba(255, 255, 255, 0.5)',
              marginBottom: '32px',
            }}
          >
            GetClayed Profile
          </div>
          
          {/* GetClayed branding */}
          <div
            style={{
              marginTop: '48px',
              fontSize: '16px',
              color: 'white',
            }}
          >
            GetClayed
          </div>
        </div>
        
        {/* Right side - Default clay ball */}
        <div
          style={{
            width: '500px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 60px 40px 20px',
          }}
        >
          <div
            style={{
              width: '320px',
              height: '320px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #B8C5D6 0%, #9DB4CC 100%)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '260px',
                height: '260px',
                borderRadius: '50%',
                background: 'linear-gradient(225deg, #B8C5D6 0%, #9DB4CC 100%)',
                boxShadow: 'inset 0 8px 20px rgba(0, 0, 0, 0.12)',
              }}
            />
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800, // 3:2 aspect ratio for Farcaster
    }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    
    // Determine if it's a wallet address or display name
    let walletAddress: string;
    let inputDisplayName: string | null = null;
    
    if (isWalletAddress(address)) {
      walletAddress = address.toLowerCase();
    } else {
      // It's a display name, need to find the wallet address
      inputDisplayName = address;
      const foundWallet = await findUserByDisplayName(address);
      if (!foundWallet) {
        // User not found, return fallback with display name
        return generateFallbackImage(address);
      }
      walletAddress = foundWallet.toLowerCase();
    }
    
    // Fetch profile data and stats in parallel
    const [profile, projectCount, followerCount] = await Promise.all([
      fetchUserProfile(walletAddress),
      fetchProjectCount(walletAddress),
      fetchFollowerCount(walletAddress)
    ]);
    
    const displayName = profile?.displayName || inputDisplayName || shortenAddress(walletAddress);
    const avatarUrl = profile?.avatarUrl;
    
    // Try to get avatar image data if it's an Irys ID
    let avatarImageData: string | null = null;
    if (avatarUrl && !avatarUrl.startsWith('data:') && !avatarUrl.startsWith('http')) {
      try {
        const avatarResponse = await fetch(`https://uploader.irys.xyz/tx/${avatarUrl}/data`);
        if (avatarResponse.ok) {
          const contentType = avatarResponse.headers.get('content-type');
          if (contentType?.includes('image')) {
            const buffer = await avatarResponse.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            avatarImageData = `data:${contentType};base64,${base64}`;
          }
        }
      } catch (e) {
        console.error('[Profile OG] Error loading avatar:', e);
      }
    } else if (avatarUrl?.startsWith('data:')) {
      avatarImageData = avatarUrl;
    }
    
    // Check if we have an avatar image
    const hasAvatar = !!avatarImageData;
    
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Left side - Text content */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '60px 40px 60px 60px',
            }}
          >
            {/* Profile name */}
            <div
              style={{
                fontSize: '56px',
                fontWeight: '700',
                color: 'white',
                marginBottom: '16px',
                letterSpacing: '-0.02em',
              }}
            >
              {displayName}
            </div>
            
            {/* Wallet address if has display name */}
            {profile?.displayName && (
              <div
                style={{
                  fontSize: '20px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  marginBottom: '32px',
                }}
              >
                {shortenAddress(walletAddress)}
              </div>
            )}
            
            {/* Stats */}
            <div
              style={{
                display: 'flex',
                gap: '40px',
                marginTop: profile?.displayName ? '0' : '24px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '36px', fontWeight: '700', color: 'white' }}>
                  {projectCount}
                </span>
                <span style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.6)' }}>
                  projects
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '36px', fontWeight: '700', color: 'white' }}>
                  {followerCount}
                </span>
                <span style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.6)' }}>
                  followers
                </span>
              </div>
            </div>
            
            {/* GetClayed branding */}
            <div
              style={{
                marginTop: '48px',
                fontSize: '16px',
                color: 'white',
              }}
            >
              GetClayed
            </div>
          </div>
          
          {/* Right side - Profile image */}
          <div
            style={{
              width: '500px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 60px 40px 20px',
            }}
          >
            {hasAvatar ? (
              <img
                src={avatarImageData!}
                style={{
                  width: '380px',
                  height: '380px',
                  borderRadius: '24px',
                  objectFit: 'cover',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '320px',
                  height: '320px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #B8C5D6 0%, #9DB4CC 100%)',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '260px',
                    height: '260px',
                    borderRadius: '50%',
                    background: 'linear-gradient(225deg, #B8C5D6 0%, #9DB4CC 100%)',
                    boxShadow: 'inset 0 8px 20px rgba(0, 0, 0, 0.12)',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800, // 3:2 aspect ratio for Farcaster
      }
    );
  } catch (error) {
    console.error('[Profile OG] Error:', error);
    
    // Fallback image on error - same style
    return generateFallbackImage('GetClayed Profile');
  }
}
