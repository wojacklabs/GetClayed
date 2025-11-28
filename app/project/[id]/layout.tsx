import { Metadata } from 'next'
import { createFarcasterEmbedTags, BASE_URL } from '@/lib/farcasterMetadata'

const IRYS_GRAPHQL_URL = 'https://uploader.irys.xyz/graphql'

/**
 * Get project's latest transaction ID via GraphQL
 */
async function getProjectLatestTxId(projectId: string): Promise<string | null> {
  try {
    const query = `
      query {
        transactions(
          tags: [
            { name: "App-Name", values: ["GetClayed"] },
            { name: "Data-Type", values: ["clay-project", "clay-project-manifest"] },
            { name: "Project-ID", values: ["${projectId}"] }
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
    `

    const response = await fetch(IRYS_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    if (!response.ok) return null

    const result = await response.json()
    const edges = result.data?.transactions?.edges || []
    
    if (edges.length === 0) return null
    return edges[0].node.id
  } catch (error) {
    console.error('[Layout] Error querying project:', error)
    return null
  }
}

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
    // First, check if id is a Project-ID or Transaction ID
    // Project-IDs start with 'clay-', Transaction IDs are base58 hashes
    let txId = id
    
    if (id.startsWith('clay-')) {
      // It's a Project-ID, need to get the latest Transaction ID
      const latestTxId = await getProjectLatestTxId(id)
      if (latestTxId) {
        txId = latestTxId
      }
    }
    
    // Fetch project data from Irys using the Transaction ID
    const IRYS_DATA_URL = `https://uploader.irys.xyz/tx/${txId}/data`
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
  // Use version 2 to bust Farcaster's cache of old static PNG
  const ogImageUrl = `${BASE_URL}/api/og/screenshot/project/${id}?v=apng2`
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
