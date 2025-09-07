import { Metadata } from 'next'
import { createFarcasterEmbedTags, BASE_URL } from '@/lib/farcasterMetadata'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  
  // Try to fetch library asset data
  let assetName = 'Library Asset'
  let assetAuthor = 'Unknown'
  let assetDescription = 'Reusable 3D clay component from GetClayed Library'
  let royaltyETH = ''
  let royaltyUSDC = ''
  let thumbnailId = ''
  
  try {
    // First, try to get library asset info from smart contract via GraphQL
    const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql';
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["library-registration"] },
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
        const nameTag = tags.find((t: any) => t.name === 'Asset-Name' || t.name === 'Name');
        const authorTag = tags.find((t: any) => t.name === 'Registered-By' || t.name === 'Original-Creator');
        const descTag = tags.find((t: any) => t.name === 'Description');
        const royaltyETHTag = tags.find((t: any) => t.name === 'Royalty-ETH');
        const royaltyUSDCTag = tags.find((t: any) => t.name === 'Royalty-USDC');
        const thumbnailTag = tags.find((t: any) => t.name === 'Thumbnail-ID');
        
        if (nameTag) assetName = nameTag.value;
        if (authorTag) assetAuthor = authorTag.value;
        if (descTag) assetDescription = descTag.value;
        if (royaltyETHTag) royaltyETH = royaltyETHTag.value;
        if (royaltyUSDCTag) royaltyUSDC = royaltyUSDCTag.value;
        if (thumbnailTag) thumbnailId = thumbnailTag.value;
        
        console.log('[Library Metadata] Found from GraphQL:', { assetName, assetAuthor });
      }
    }
    
    // Fallback: Try to fetch from Irys directly
    if (assetName === 'Library Asset') {
      const IRYS_DATA_URL = `https://uploader.irys.xyz/tx/${id}/data`;
      const response = await fetch(IRYS_DATA_URL, {
        next: { revalidate: 3600 },
        headers: { 'Accept': 'application/json' },
      });
      
      if (response.ok) {
        const assetData = await response.json();
        
        if (assetData.chunkSetId && assetData.totalChunks) {
          assetName = assetData.projectName || assetData.name || 'Library Asset';
          assetDescription = assetData.description || 'A reusable 3D clay component from GetClayed Library';
        } else {
          assetName = assetData.name || assetName;
          assetAuthor = assetData.author || assetData.creator || assetAuthor;
          assetDescription = assetData.description || assetDescription;
          royaltyETH = assetData.royaltyPerImportETH || royaltyETH;
          royaltyUSDC = assetData.royaltyPerImportUSDC || royaltyUSDC;
          thumbnailId = assetData.thumbnailId || assetData.tags?.['Thumbnail-ID'] || thumbnailId;
        }
        
        console.log('[Library Metadata] Found from Irys data:', { assetName, assetAuthor });
      }
    }
  } catch (error) {
    console.log('Could not fetch library asset data for metadata:', error)
    // Use default values
  }
  
  // Use screenshot API for real 3D rendering via iframe/Puppeteer
  // Use version 2 to bust Farcaster's cache of old static PNG
  const ogImageUrl = `${BASE_URL}/api/og/screenshot/library/${id}?v=apng2`
  const pageUrl = `${BASE_URL}/library/${id}`
  
  // Farcaster 미니앱용 메타 태그 생성
  const farcasterTags = createFarcasterEmbedTags({
    buttonTitle: `View ${assetName}`,
    targetUrl: pageUrl,
    imageUrl: ogImageUrl,
  })
  
  return {
    metadataBase: new URL(BASE_URL),
    title: `${assetName} - GetClayed Library`,
    description: assetDescription,
    openGraph: {
      title: `${assetName} - GetClayed Library`,
      description: assetDescription,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 800,
          alt: assetName,
        },
      ],
      url: `/library/${id}`,
      siteName: 'GetClayed',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${assetName} - GetClayed Library`,
      description: assetDescription,
      images: [ogImageUrl],
    },
    other: farcasterTags,
  }
}

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
