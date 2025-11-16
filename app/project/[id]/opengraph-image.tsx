import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';
export const alt = 'GetClayed Project';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f9fafb',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '20px',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '32px',
              fontSize: '56px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
              border: '1px solid #e5e7eb',
            }}
          >
            🏺
          </div>
          <div
            style={{
              fontSize: '56px',
              fontWeight: '700',
              color: '#111827',
              textAlign: 'center',
              marginBottom: '16px',
              letterSpacing: '-0.02em',
            }}
          >
            3D Clay Project
          </div>
          <div
            style={{
              fontSize: '22px',
              color: '#6b7280',
              fontWeight: '500',
            }}
          >
            View on GetClayed
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            fontSize: '20px',
            color: '#9ca3af',
            fontWeight: '500',
          }}
        >
          GetClayed
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
