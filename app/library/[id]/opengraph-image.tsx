import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';
export const alt = 'GetClayed Library Asset';
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
              fontSize: '18px',
              color: '#6b7280',
              fontWeight: '600',
              marginBottom: '24px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            📚 Library Asset
          </div>
          <div
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #B8C5D6 0%, #9DB4CC 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '32px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
              border: '3px solid white',
            }}
          >
            <div
              style={{
                width: '75px',
                height: '75px',
                borderRadius: '50%',
                background: 'linear-gradient(225deg, #B8C5D6 0%, #9DB4CC 100%)',
                boxShadow: 'inset 0 3px 6px rgba(0, 0, 0, 0.1)',
              }}
            />
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
            Reusable Component
          </div>
          <div
            style={{
              fontSize: '22px',
              color: '#6b7280',
              fontWeight: '500',
            }}
          >
            Browse on GetClayed Library
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
          GetClayed Library
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
