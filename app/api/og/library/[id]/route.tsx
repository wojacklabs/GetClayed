import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // URL에서 라이브러리 정보 가져오기
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || 'Untitled Asset';
    const author = searchParams.get('author') || 'Unknown';
    const royaltyETH = searchParams.get('royaltyETH') || '';
    const royaltyUSDC = searchParams.get('royaltyUSDC') || '';
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
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
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
            {/* 라이브러리 아이콘 */}
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
            
            {/* 라이브러리 이름 */}
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
            
            {/* 작가 */}
            <div
              style={{
                fontSize: '28px',
                color: '#6b7280',
                marginBottom: '20px',
              }}
            >
              by {author.slice(0, 6)}...{author.slice(-4)}
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
            
            {/* 로열티 정보 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '22px',
                  color: '#6b7280',
                  fontWeight: '600',
                }}
              >
                Royalty per Import
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '40px',
                }}
              >
                {royaltyETH && parseFloat(royaltyETH) > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      backgroundColor: '#f3f4f6',
                      padding: '16px 32px',
                      borderRadius: '12px',
                    }}
                  >
                    <div style={{ fontSize: '28px' }}>⟠</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#374151' }}>
                      {royaltyETH} ETH
                    </div>
                  </div>
                )}
                {royaltyUSDC && parseFloat(royaltyUSDC) > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      backgroundColor: '#f3f4f6',
                      padding: '16px 32px',
                      borderRadius: '12px',
                    }}
                  >
                    <div style={{ fontSize: '28px' }}>💵</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#374151' }}>
                      {royaltyUSDC} USDC
                    </div>
                  </div>
                )}
              </div>
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
              Library
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

