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
          background: '#f9fafb',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '80px 100px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            borderRadius: '32px',
            padding: '50px 70px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.06)',
            border: '1px solid #e5e7eb',
          }}
        >
          <div
            style={{
              backgroundColor: '#111827',
              color: 'white',
              fontSize: '14px',
              fontWeight: '700',
              padding: '8px 24px',
              borderRadius: '10px',
              marginBottom: '24px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            FOR SALE
          </div>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #B8C5D6 0%, #9DB4CC 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)',
              border: '2px solid #f9fafb',
            }}
          >
            <div
              style={{
                width: '62px',
                height: '62px',
                borderRadius: '50%',
                background: 'linear-gradient(225deg, #B8C5D6 0%, #9DB4CC 100%)',
                boxShadow: 'inset 0 2px 5px rgba(0, 0, 0, 0.1)',
              }}
            />
          </div>
          <div
            style={{
              fontSize: '44px',
              fontWeight: '700',
              color: '#111827',
              textAlign: 'center',
              marginBottom: '12px',
              letterSpacing: '-0.02em',
            }}
          >
            Unique Creation
          </div>
          <div
            style={{
              fontSize: '18px',
              color: '#6b7280',
              fontWeight: '500',
            }}
          >
            Browse GetClayed Marketplace
          </div>
        </div>
        <div
          style={{
            marginTop: '32px',
            fontSize: '18px',
            color: '#9ca3af',
            fontWeight: '500',
          }}
        >
          GetClayed Marketplace
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
