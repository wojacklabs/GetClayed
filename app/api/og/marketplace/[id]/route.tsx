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
              maxWidth: '700px',
            }}
          >
            {/* FOR SALE 배지 */}
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

            {/* 아이콘 - 지점토 구체 */}
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
            
            {/* 이름 */}
            <div
              style={{
                fontSize: '44px',
                fontWeight: '700',
                color: '#111827',
                textAlign: 'center',
                marginBottom: '12px',
                maxWidth: '600px',
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
                gap: '10px',
                marginBottom: '24px',
              }}
            >
              <div style={{ fontSize: '36px', fontWeight: '800', color: '#111827' }}>
                {price}
              </div>
              <div style={{ fontSize: '22px', color: '#6b7280', fontWeight: '600' }}>
                ETH
              </div>
            </div>
            
            {/* 판매자 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                backgroundColor: '#f9fafb',
                borderRadius: '10px',
                border: '1px solid #e5e7eb',
              }}
            >
              <div style={{ fontSize: '16px', color: '#6b7280', fontWeight: '500' }}>
                Seller:
              </div>
              <div style={{ fontSize: '16px', color: '#111827', fontWeight: '600' }}>
                {seller.slice(0, 6)}...{seller.slice(-4)}
              </div>
            </div>
          </div>
          
          {/* 하단 브랜딩 */}
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
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('OG Image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
