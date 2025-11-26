import { Metadata } from 'next'
import { createFarcasterEmbedTags, BASE_URL } from '@/lib/farcasterMetadata'

// Note: This is a Server Component that runs at build time and on request
// For dynamic data, we'll use the API endpoint with query parameters
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  
  // Try to fetch project data
  let projectName = '3D Clay Project'
  let projectAuthor = 'Unknown'
  let projectDescription = 'View this unique 3D clay sculpture on GetClayed'
  let thumbnailId = ''
  
  try {
    // Fetch project data from Irys
    // Use the direct data endpoint
    const IRYS_DATA_URL = `https://uploader.irys.xyz/tx/${id}/data`
    const response = await fetch(IRYS_DATA_URL, {
      next: { revalidate: 3600 }, // Cache for 1 hour
      headers: {
        'Accept': 'application/json',
      },
    })
    
    if (response.ok) {
      const projectData = await response.json()
      
      // Check if it's a chunk manifest (multi-part project)
      if (projectData.chunkSetId && projectData.totalChunks) {
        // For chunked projects, we can't easily reassemble on the server
        // But we can use the manifest metadata
        projectName = projectData.projectName || projectData.name || '3D Clay Project'
        projectDescription = projectData.description || 'A 3D clay sculpture on GetClayed'
        // Chunk manifests don't have thumbnailId in the manifest itself
        // Thumbnails are stored separately
      } else {
        // Regular project
        projectName = projectData.name || projectName
        projectAuthor = projectData.author || projectData.creator || projectAuthor
        projectDescription = projectData.description || projectDescription
        thumbnailId = projectData.thumbnailId || projectData.tags?.['Thumbnail-ID'] || ''
      }
    }
  } catch (error) {
    console.log('Could not fetch project data for metadata:', error)
    // Use default values
  }
  
  // Use screenshot API for real 3D rendering via iframe/Puppeteer
  // Use project ID + short hash of ID as cache buster (stable but unique per project)
  const cacheKey = id.slice(-8)
  const ogImageUrl = `${BASE_URL}/api/og/screenshot/project/${id}?v=${cacheKey}`
  const pageUrl = `${BASE_URL}/project/${id}`
  
  // Farcaster 미니앱용 메타 태그 생성
  const farcasterTags = createFarcasterEmbedTags({
    buttonTitle: `View ${projectName}`,
    targetUrl: pageUrl,
    imageUrl: ogImageUrl,
  })
  
  return {
    metadataBase: new URL(BASE_URL),
    title: `${projectName} - GetClayed`,
    description: projectDescription,
    openGraph: {
      title: `${projectName} - GetClayed`,
      description: projectDescription,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 800,
          alt: projectName,
        },
      ],
      url: `/project/${id}`,
      siteName: 'GetClayed',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${projectName} - GetClayed`,
      description: projectDescription,
      images: [ogImageUrl],
    },
    other: farcasterTags,
  }
}

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
