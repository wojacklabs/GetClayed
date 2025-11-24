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
          overflow: 'hidden',
        }}
      >
        {/* Animated-like background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Clay shapes */}
          <div
            style={{
              position: 'absolute',
              width: 200,
              height: 200,
              background: 'linear-gradient(135deg, #7877C6 0%, #9988DD 100%)',
              borderRadius: '50%',
              left: '10%',
              top: '20%',
              transform: 'rotate(45deg)',
              opacity: 0.3,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 150,
              height: 150,
              background: 'linear-gradient(135deg, #FF77C6 0%, #FF99DD 100%)',
              borderRadius: '30%',
              right: '15%',
              top: '30%',
              transform: 'rotate(-30deg)',
              opacity: 0.3,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 180,
              height: 180,
              background: 'linear-gradient(135deg, #FFD962 0%, #FFE599 100%)',
              borderRadius: '40%',
              left: '20%',
              bottom: '25%',
              transform: 'rotate(60deg)',
              opacity: 0.3,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 120,
              height: 120,
              background: 'linear-gradient(135deg, #77C6FF 0%, #99DDFF 100%)',
              borderRadius: '25%',
              right: '25%',
              bottom: '20%',
              transform: 'rotate(-45deg)',
              opacity: 0.3,
            }}
          />
        </div>
        
        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          {/* Logo */}
          <div
            style={{
              width: 160,
              height: 160,
              background: 'linear-gradient(135deg, #7877C6 0%, #FF77C6 50%, #FFD962 100%)',
              borderRadius: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 40,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div
              style={{
                fontSize: 80,
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              C
            </div>
          </div>
          
          {/* Title */}
          <h1
            style={{
              fontSize: 96,
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #7877C6 0%, #FF77C6 50%, #FFD962 100%)',
              backgroundClip: 'text',
              color: 'transparent',
              margin: 0,
              marginBottom: 30,
              textShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
            }}
          >
            GetClayed
          </h1>
          
          {/* Tagline */}
          <p
            style={{
              fontSize: 36,
              fontWeight: '600',
              color: '#fff',
              margin: 0,
              marginBottom: 20,
              opacity: 0.9,
            }}
          >
            No Blender, Just Clay
          </p>
          
          {/* Description */}
          <p
            style={{
              fontSize: 24,
              color: '#aaa',
              margin: 0,
              textAlign: 'center',
              maxWidth: 600,
              lineHeight: 1.5,
            }}
          >
            Create 3D art on-chain with the simplicity of childhood play
          </p>
        </div>
      </div>
    ),
    {
      width: 1920,
      height: 1080,
    }
  )
}
