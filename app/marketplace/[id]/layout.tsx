import { Metadata } from 'next'
import { createFarcasterEmbedTags, BASE_URL } from '@/lib/farcasterMetadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  
  // Try to fetch marketplace listing data
  let itemName = 'Unique Creation'
  let itemSeller = 'Unknown'
  let itemPrice = '0'
  let itemDescription = 'Unique 3D clay sculpture for sale on GetClayed Marketplace'
  let thumbnailId = ''
  
  try {
    // First, try to get listing info from smart contract via GraphQL
    const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["marketplace-listing"] },
            { name: "Project-ID", values: ["${id}"] }
          ],
          first: 1,
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
    
    const graphqlResponse = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      next: { revalidate: 3600 }
    });
    
    if (graphqlResponse.ok) {
      const result = await graphqlResponse.json();
      if (result.data?.transactions?.edges?.[0]) {
        const tags = result.data.transactions.edges[0].node.tags;
        const nameTag = tags.find((t: any) => t.name === 'Name' || t.name === 'Asset-Name');
        const sellerTag = tags.find((t: any) => t.name === 'Seller');
        const priceTag = tags.find((t: any) => t.name === 'Price');
        const descTag = tags.find((t: any) => t.name === 'Description');
        const thumbnailTag = tags.find((t: any) => t.name === 'Thumbnail-ID');
        
        if (nameTag) itemName = nameTag.value;
        if (sellerTag) itemSeller = sellerTag.value;
        if (priceTag) itemPrice = priceTag.value;
        if (descTag) itemDescription = descTag.value;
        if (thumbnailTag) thumbnailId = thumbnailTag.value;
        
        console.log('[Marketplace Metadata] Found from GraphQL:', { itemName, itemSeller, itemPrice });
      }
    }
    
    // Fallback: Try to fetch project data from Irys
    if (itemName === 'Unique Creation') {
      const IRYS_DATA_URL = `https://uploader.irys.xyz/tx/${id}/data`;
      const response = await fetch(IRYS_DATA_URL, {
        next: { revalidate: 3600 },
        headers: { 'Accept': 'application/json' },
      });
      
      if (response.ok) {
        const projectData = await response.json();
        
        if (projectData.chunkSetId && projectData.totalChunks) {
          itemName = projectData.projectName || projectData.name || 'Unique Creation';
          itemDescription = projectData.description || 'A unique 3D clay sculpture for sale on GetClayed Marketplace';
        } else {
          itemName = projectData.name || itemName;
          itemSeller = projectData.author || projectData.creator || itemSeller;
          itemDescription = projectData.description || itemDescription;
          thumbnailId = projectData.thumbnailId || projectData.tags?.['Thumbnail-ID'] || thumbnailId;
        }
        
        console.log('[Marketplace Metadata] Found from Irys data:', { itemName, itemSeller });
      }
    }
  } catch (error) {
    console.log('Could not fetch marketplace listing data for metadata:', error)
    // Use default values
  }
  
  // Use screenshot API for real 3D rendering via iframe/Puppeteer
  // Use version 2 to bust Farcaster's cache of old static PNG
  const ogImageUrl = `${BASE_URL}/api/og/screenshot/marketplace/${id}?v=apng2`
  const pageUrl = `${BASE_URL}/marketplace/${id}`
  
  // Farcaster 미니앱용 메타 태그 생성
  const farcasterTags = createFarcasterEmbedTags({
    buttonTitle: `View ${itemName}`,
    targetUrl: pageUrl,
    imageUrl: ogImageUrl,
  })
  
  return {
    metadataBase: new URL(BASE_URL),
    title: `${itemName} - For Sale on GetClayed`,
    description: itemDescription,
    openGraph: {
      title: `${itemName} - For Sale on GetClayed`,
      description: itemDescription,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 800,
          alt: itemName,
        },
      ],
      url: `/marketplace/${id}`,
      siteName: 'GetClayed',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${itemName} - For Sale on GetClayed`,
      description: itemDescription,
      images: [ogImageUrl],
    },
    other: farcasterTags,
  }
}

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
