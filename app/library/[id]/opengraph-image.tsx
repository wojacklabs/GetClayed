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
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '24px',
            padding: '60px',
            margin: '40px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              backgroundColor: '#ec4899',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '30px',
              fontSize: '60px',
            }}
          >
            📚
          </div>
          <div
            style={{
              fontSize: '56px',
              fontWeight: 'bold',
              color: '#1f2937',
              textAlign: 'center',
              marginBottom: '20px',
            }}
          >
            Library Asset
          </div>
          <div
            style={{
              fontSize: '28px',
              color: '#6b7280',
              marginBottom: '20px',
            }}
          >
            ID: {id}
          </div>
          <div
            style={{
              fontSize: '22px',
              color: '#6b7280',
              fontWeight: '600',
            }}
          >
            Reusable 3D Component
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginTop: '30px',
          }}
        >
          <div style={{ fontSize: '40px', fontWeight: 'bold', color: 'white' }}>
            GetClayed
          </div>
          <div style={{ fontSize: '32px', color: 'rgba(255, 255, 255, 0.8)' }}>
            Library
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

