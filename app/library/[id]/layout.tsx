import { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  
  // Base URL for OG images
  const baseUrl = 'https://getclayed.io'
  
  // Try to fetch library asset data
  let assetName = 'Library Asset'
  let assetAuthor = 'Unknown'
  let assetDescription = 'Reusable 3D clay component from GetClayed Library'
  let royaltyETH = ''
  let royaltyUSDC = ''
  let thumbnailId = ''
  
  try {
    // Fetch asset data from Irys
    const IRYS_DATA_URL = `https://uploader.irys.xyz/tx/${id}/data`
    const response = await fetch(IRYS_DATA_URL, {
      next: { revalidate: 3600 }, // Cache for 1 hour
      headers: {
        'Accept': 'application/json',
      },
    })
    
    if (response.ok) {
      const assetData = await response.json()
      
      // Check if it's a chunk manifest
      if (assetData.chunkSetId && assetData.totalChunks) {
        assetName = assetData.projectName || assetData.name || 'Library Asset'
        assetDescription = assetData.description || 'A reusable 3D clay component from GetClayed Library'
      } else {
        assetName = assetData.name || assetName
        assetAuthor = assetData.author || assetData.creator || assetAuthor
        assetDescription = assetData.description || assetDescription
        royaltyETH = assetData.royaltyPerImportETH || ''
        royaltyUSDC = assetData.royaltyPerImportUSDC || ''
        thumbnailId = assetData.thumbnailId || assetData.tags?.['Thumbnail-ID'] || ''
      }
    }
  } catch (error) {
    console.log('Could not fetch library asset data for metadata:', error)
    // Use default values
  }
  
  // Build query params for OG image
  const params_obj = new URLSearchParams({
    name: assetName,
    author: assetAuthor,
  })
  if (royaltyETH) params_obj.append('royaltyETH', royaltyETH)
  if (royaltyUSDC) params_obj.append('royaltyUSDC', royaltyUSDC)
  if (thumbnailId) params_obj.append('thumbnailId', thumbnailId)
  
  const ogImageUrl = `${baseUrl}/api/og/library/${id}?${params_obj.toString()}`
  
  return {
    metadataBase: new URL(baseUrl),
    title: `${assetName} - GetClayed Library`,
    description: assetDescription,
    openGraph: {
      title: `${assetName} - GetClayed Library`,
      description: assetDescription,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
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
    other: {
      // Farcaster frame metadata for better preview
      'fc:frame': 'vNext',
      'fc:frame:image': ogImageUrl,
      'fc:frame:image:aspect_ratio': '1.91:1',
      'fc:frame:button:1': 'View in Library',
      'fc:frame:button:1:action': 'link',
      'fc:frame:button:1:target': `${baseUrl}/library/${id}`,
    },
  }
}

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
