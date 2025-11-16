import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';
export const alt = 'GetClayed Marketplace Listing';
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
          background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
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
              backgroundColor: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '30px',
              fontSize: '60px',
            }}
          >
            🛒
          </div>
          <div
            style={{
              backgroundColor: '#10b981',
              color: 'white',
              fontSize: '22px',
              fontWeight: 'bold',
              padding: '12px 32px',
              borderRadius: '24px',
              marginBottom: '24px',
            }}
          >
            FOR SALE
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
            Marketplace Listing
          </div>
          <div
            style={{
              fontSize: '28px',
              color: '#6b7280',
              marginBottom: '30px',
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
            Unique 3D Creation
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
            Marketplace
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

