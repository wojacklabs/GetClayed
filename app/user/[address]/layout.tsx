import { Metadata } from 'next';
import { createFarcasterEmbedTags, BASE_URL } from '@/lib/farcasterMetadata';

// Helper to shorten address
function shortenAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Fetch user profile for metadata
async function fetchUserProfileMetadata(walletAddress: string) {
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
      body: JSON.stringify({ query }),
      next: { revalidate: 300 } // Cache for 5 minutes
    });
    
    const result = await response.json();
    
    if (result.data?.transactions?.edges?.length > 0) {
      const txId = result.data.transactions.edges[0].node.id;
      const dataResponse = await fetch(`https://uploader.irys.xyz/tx/${txId}/data`, {
        next: { revalidate: 300 }
      });
      
      if (dataResponse.ok) {
        const text = await dataResponse.text();
        const data = JSON.parse(text);
        
        // Check if it's a chunk manifest
        if (data.chunkSetId && data.totalChunks && data.chunks) {
          // For metadata, we don't need to download full profile
          // Just return null and use address as fallback
          return null;
        }
        
        return data;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[Profile Layout] Error fetching profile metadata:', error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>
}): Promise<Metadata> {
  const { address } = await params;
  
  let displayName = shortenAddress(address);
  let description = `View ${displayName}'s profile on GetClayed - 3D sculpting on-chain`;
  
  try {
    // Check if it's an address or display name
    if (address.startsWith('0x') && address.length === 42) {
      const profile = await fetchUserProfileMetadata(address);
      if (profile?.displayName) {
        displayName = profile.displayName;
        description = `View ${displayName}'s 3D creations on GetClayed`;
      }
    } else {
      // It's a display name
      displayName = address;
      description = `View ${displayName}'s 3D creations on GetClayed`;
    }
  } catch (error) {
    console.log('Could not fetch profile data for metadata:', error);
  }
  
  const ogImageUrl = `${BASE_URL}/api/og/profile/${address}`;
  const pageUrl = `${BASE_URL}/user/${address}`;
  
  // Farcaster 미니앱용 메타 태그 생성
  const farcasterTags = createFarcasterEmbedTags({
    buttonTitle: `View ${displayName}`,
    targetUrl: pageUrl,
    imageUrl: ogImageUrl,
  });
  
  return {
    metadataBase: new URL(BASE_URL),
    title: `${displayName} - GetClayed`,
    description,
    openGraph: {
      title: `${displayName} - GetClayed`,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 800,
          alt: `${displayName}'s profile`,
        },
      ],
      url: `/user/${address}`,
      siteName: 'GetClayed',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${displayName} - GetClayed`,
      description,
      images: [ogImageUrl],
    },
    other: farcasterTags,
  };
}

export default function UserProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>;
}

