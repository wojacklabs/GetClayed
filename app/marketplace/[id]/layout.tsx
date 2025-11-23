import { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  
  // Base URL for OG images
  const baseUrl = 'https://getclayed.vercel.app'
  
  // Try to fetch marketplace listing data
  let itemName = 'Unique Creation'
  let itemSeller = 'Unknown'
  let itemPrice = '0'
  let itemDescription = 'Unique 3D clay sculpture for sale on GetClayed Marketplace'
  let thumbnailId = ''
  
  try {
    // Fetch project data from Irys
    const IRYS_DATA_URL = `https://uploader.irys.xyz/tx/${id}/data`
    const response = await fetch(IRYS_DATA_URL, {
      next: { revalidate: 3600 }, // Cache for 1 hour
      headers: {
        'Accept': 'application/json',
      },
    })
    
    if (response.ok) {
      const projectData = await response.json()
      
      // Check if it's a chunk manifest
      if (projectData.chunkSetId && projectData.totalChunks) {
        itemName = 'Unique Creation'
        itemDescription = 'A unique 3D clay sculpture for sale on GetClayed Marketplace'
      } else {
        itemName = projectData.name || itemName
        itemSeller = projectData.author || projectData.creator || itemSeller
        itemDescription = projectData.description || itemDescription
        thumbnailId = projectData.thumbnailId || projectData.tags?.['Thumbnail-ID'] || ''
        // Note: Price comes from contract, not Irys - would need smart contract query
      }
    }
  } catch (error) {
    console.log('Could not fetch marketplace listing data for metadata:', error)
    // Use default values
  }
  
  // Build query params for OG image
  const params_obj = new URLSearchParams({
    name: itemName,
    seller: itemSeller,
    price: itemPrice,
  })
  if (thumbnailId) params_obj.append('thumbnailId', thumbnailId)
  
  const ogImageUrl = `${baseUrl}/api/og/marketplace/${id}?${params_obj.toString()}`
  
  return {
    metadataBase: new URL(baseUrl),
    title: `${itemName} - For Sale on GetClayed`,
    description: itemDescription,
    openGraph: {
      title: `${itemName} - For Sale on GetClayed`,
      description: itemDescription,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
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
    other: {
      // Farcaster frame metadata for better preview
      'fc:frame': 'vNext',
      'fc:frame:image': ogImageUrl,
      'fc:frame:image:aspect_ratio': '1.91:1',
      'fc:frame:button:1': 'View Listing',
      'fc:frame:button:1:action': 'link',
      'fc:frame:button:1:target': `${baseUrl}/marketplace/${id}`,
    },
  }
}

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
