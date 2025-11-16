import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // URL에서 마켓플레이스 정보 가져오기
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || 'Untitled Asset';
    const seller = searchParams.get('seller') || 'Unknown';
    const price = searchParams.get('price') || '0';
    const description = searchParams.get('description') || '';
    
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
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {/* 메인 콘텐츠 */}
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
              maxWidth: '900px',
            }}
          >
            {/* 마켓플레이스 아이콘 */}
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
            
            {/* FOR SALE 뱃지 */}
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
            
            {/* 자산 이름 */}
            <div
              style={{
                fontSize: '56px',
                fontWeight: 'bold',
                color: '#1f2937',
                textAlign: 'center',
                marginBottom: '20px',
                maxWidth: '800px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </div>
            
            {/* 설명 */}
            {description && (
              <div
                style={{
                  fontSize: '24px',
                  color: '#9ca3af',
                  textAlign: 'center',
                  marginBottom: '30px',
                  maxWidth: '700px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {description}
              </div>
            )}
            
            {/* 가격 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '30px',
              }}
            >
              <div
                style={{
                  fontSize: '22px',
                  color: '#6b7280',
                  fontWeight: '600',
                }}
              >
                Price
              </div>
              <div
                style={{
                  fontSize: '64px',
                  fontWeight: 'bold',
                  color: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div style={{ fontSize: '48px' }}>⟠</div>
                {price}
              </div>
            </div>
            
            {/* 판매자 */}
            <div
              style={{
                fontSize: '24px',
                color: '#6b7280',
              }}
            >
              Seller: {seller.slice(0, 6)}...{seller.slice(-4)}
            </div>
          </div>
          
          {/* 하단 브랜딩 */}
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
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('OG Image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}

