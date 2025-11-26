import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    const name = searchParams.get('name') || 'Untitled Project';
    const author = searchParams.get('author') || 'Unknown';
    const thumbnailId = searchParams.get('thumbnailId');
    
    // Try to get actual project data for rendering
    let clayObjects: any[] = [];
    let backgroundColor = '#000000';
    
    try {
      const projectResponse = await fetch(`https://uploader.irys.xyz/tx/${id}/data`);
      if (projectResponse.ok) {
        const projectData = await projectResponse.json();
        
        // Check if it's a chunk manifest
        if (projectData.chunkSetId && projectData.totalChunks) {
          // For chunked projects, try to fetch and reassemble
          try {
            const chunks = projectData.chunks || [];
            let reassembledProject: any = null;
            
            if (chunks.length > 0) {
              // Fetch all chunks
              const chunkPromises = chunks.map((chunkId: string) =>
                fetch(`https://uploader.irys.xyz/tx/${chunkId}/data`).then(r => r.text())
              );
              
              const chunkData = await Promise.all(chunkPromises);
              const fullData = chunkData.join('');
              reassembledProject = JSON.parse(fullData);
              
              if (reassembledProject) {
                // Correct field name is 'clays', not 'clayObjects'
                clayObjects = reassembledProject.clays || [];
                backgroundColor = reassembledProject.backgroundColor || '#000000';
                console.log(`[OG] Reassembled ${clayObjects.length} objects from chunks`);
              }
            }
          } catch (error) {
            console.error('[OG] Failed to reassemble chunks:', error);
          }
        } else {
          // Regular project - correct field name is 'clays', not 'clayObjects'
          clayObjects = projectData.clays || [];
          backgroundColor = projectData.backgroundColor || '#000000';
        }
        
        // If we have a thumbnail ID from the project data itself, use it
        const projectThumbnailId = thumbnailId || projectData.thumbnailId || projectData.tags?.['Thumbnail-ID'];
        if (projectThumbnailId) {
          const thumbnailUrl = `https://uploader.irys.xyz/tx/${projectThumbnailId}/data`;
          
          try {
            const response = await fetch(thumbnailUrl);
            if (response.ok) {
              const imageBuffer = await response.arrayBuffer();
              return new Response(imageBuffer, {
                headers: {
                  'Content-Type': 'image/png',
                  'Cache-Control': 'public, max-age=3600, s-maxage=3600',
                },
              });
            }
          } catch (error) {
            console.error('Failed to fetch thumbnail:', error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch project data:', error);
    }
    
    // If we have clay objects, try to render them
    if (clayObjects.length > 0) {
      return new ImageResponse(
        (
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: '100%',
              backgroundColor: backgroundColor,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* 3D objects preview */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="800"
                height="400"
                viewBox="-20 -20 40 40"
                style={{
                  filter: 'drop-shadow(0 10px 30px rgba(0, 0, 0, 0.3))',
                }}
              >
                {clayObjects.slice(0, 10).map((obj, index) => {
                  const x = (obj.position?.x || 0) * 2;
                  const y = -(obj.position?.y || 0) * 2; // Invert Y for SVG
                  const z = (obj.position?.z || 0) * 0.1; // Use Z for slight offset
                  const scale = obj.scale?.x || obj.scale || 1;
                  const color = obj.color || '#3b82f6';
                  
                  // Simple 2D representation based on object type
                  switch(obj.type) {
                    case 'box':
                      return (
                        <rect
                          key={index}
                          x={x - scale}
                          y={y - scale}
                          width={scale * 2}
                          height={scale * 2}
                          fill={color}
                          opacity={0.9 - z * 0.05}
                          transform={`rotate(${(obj.rotation?.z || 0) * 57.3} ${x} ${y})`}
                        />
                      );
                    case 'cylinder':
                      return (
                        <ellipse
                          key={index}
                          cx={x}
                          cy={y}
                          rx={scale}
                          ry={scale * 0.8}
                          fill={color}
                          opacity={0.9 - z * 0.05}
                        />
                      );
                    default: // sphere, cone, torus, etc
                      return (
                        <circle
                          key={index}
                          cx={x}
                          cy={y}
                          r={scale}
                          fill={color}
                          opacity={0.9 - z * 0.05}
                        />
                      );
                  }
                })}
              </svg>
            </div>
            
            {/* Project info overlay */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                padding: '40px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                  textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                }}
              >
                {name}
              </div>
              <div
                style={{
                  fontSize: '20px',
                  color: '#e2e8f0',
                  textShadow: '0 1px 5px rgba(0,0,0,0.5)',
                }}
              >
                by {author.slice(0, 6)}...{author.slice(-4)}
              </div>
            </div>
            
            {/* GetClayed branding */}
            <div
              style={{
                position: 'absolute',
                top: '30px',
                right: '30px',
                fontSize: '18px',
                color: '#ffffff',
                opacity: 0.8,
                fontWeight: '500',
              }}
            >
              GetClayed
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 800, // 3:2 aspect ratio for Farcaster
        }
      );
    }
    
    // Fallback: Create a styled preview with project info
    const baseUrl = request.nextUrl.origin;
    
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            backgroundColor: '#000000',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background gradient */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            }}
          />
          
          {/* Main content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              position: 'relative',
              padding: '60px',
            }}
          >
            {/* Clay ball icon */}
            <div
              style={{
                width: '200px',
                height: '200px',
                borderRadius: '100%',
                background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                marginBottom: '40px',
                position: 'relative',
              }}
            >
              {/* Highlight */}
              <div
                style={{
                  position: 'absolute',
                  top: '20px',
                  left: '30px',
                  width: '60px',
                  height: '60px',
                  borderRadius: '100%',
                  background: 'rgba(255, 255, 255, 0.4)',
                  filter: 'blur(10px)',
                }}
              />
            </div>
            
            {/* Project name */}
            <div
              style={{
                fontSize: '56px',
                fontWeight: 'bold',
                color: '#ffffff',
                marginBottom: '16px',
                textAlign: 'center',
                maxWidth: '900px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </div>
            
            {/* Author */}
            <div
              style={{
                fontSize: '24px',
                color: '#94a3b8',
                marginBottom: '40px',
              }}
            >
              by {author.slice(0, 6)}...{author.slice(-4)}
            </div>
            
            {/* Branding */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                position: 'absolute',
                bottom: '40px',
              }}
            >
              <div
                style={{
                  fontSize: '20px',
                  color: '#64748b',
                  fontWeight: '500',
                }}
              >
                View on GetClayed
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800, // 3:2 aspect ratio for Farcaster
      }
    );
  } catch (error) {
    console.error('OG Image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}

