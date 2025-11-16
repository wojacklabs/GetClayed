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
    const name = searchParams.get('name') || 'Marketplace Item';
    const seller = searchParams.get('seller') || 'Unknown';
    const price = searchParams.get('price') || '0';
    
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
            {/* FOR SALE 배지 */}
            <div
              style={{
                backgroundColor: '#111827',
                color: 'white',
                fontSize: '18px',
                fontWeight: '700',
                padding: '10px 28px',
                borderRadius: '12px',
                marginBottom: '32px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              FOR SALE
            </div>

            {/* 아이콘 - 지점토 구체 */}
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
            
            {/* 이름 */}
            <div
              style={{
                fontSize: '56px',
                fontWeight: '700',
                color: '#111827',
                textAlign: 'center',
                marginBottom: '16px',
                maxWidth: '900px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.02em',
              }}
            >
              {name}
            </div>
            
            {/* 가격 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '32px',
              }}
            >
              <div style={{ fontSize: '48px', fontWeight: '800', color: '#111827' }}>
                {price}
              </div>
              <div style={{ fontSize: '28px', color: '#6b7280', fontWeight: '600' }}>
                ETH
              </div>
            </div>
            
            {/* 판매자 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div style={{ fontSize: '18px', color: '#6b7280', fontWeight: '500' }}>
                Seller:
              </div>
              <div style={{ fontSize: '18px', color: '#111827', fontWeight: '600' }}>
                {seller.slice(0, 6)}...{seller.slice(-4)}
              </div>
            </div>
          </div>
          
          {/* 하단 브랜딩 */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              fontSize: '20px',
              color: '#9ca3af',
              fontWeight: '500',
            }}
          >
            GetClayed Marketplace
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('OG Image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
