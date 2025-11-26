import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
          position: 'relative',
        }}
      >
        {/* Background pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 
              'radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.1) 0%, transparent 50%), ' +
              'radial-gradient(circle at 80% 80%, rgba(255, 119, 198, 0.1) 0%, transparent 50%), ' +
              'radial-gradient(circle at 40% 20%, rgba(255, 219, 98, 0.1) 0%, transparent 50%)',
          }}
        />
        
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              background: 'linear-gradient(135deg, #7877C6 0%, #FF77C6 50%, #FFD962 100%)',
              borderRadius: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontSize: 60,
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              C
            </div>
          </div>
        </div>
        
        {/* Title */}
        <h1
          style={{
            fontSize: 72,
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #7877C6 0%, #FF77C6 50%, #FFD962 100%)',
            backgroundClip: 'text',
            color: 'transparent',
            margin: 0,
            marginBottom: 20,
          }}
        >
          GetClayed
        </h1>
        
        {/* Tagline */}
        <p
          style={{
            fontSize: 32,
            color: '#888',
            margin: 0,
            marginBottom: 40,
          }}
        >
          Sculpt like a 5-year-old genius
        </p>
        
        {/* Description */}
        <p
          style={{
            fontSize: 24,
            color: '#666',
            margin: 0,
            textAlign: 'center',
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          No Blender, no tutorials - just clay. Create 3D art on-chain.
        </p>
      </div>
    ),
    {
      width: 1200,
      height: 800, // 3:2 aspect ratio for Farcaster
    }
  )
}
