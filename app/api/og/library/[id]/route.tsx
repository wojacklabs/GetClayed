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
    const name = searchParams.get('name') || 'Library Asset';
    const author = searchParams.get('author') || 'Unknown';
    const royaltyETH = searchParams.get('royaltyETH') || '';
    const royaltyUSDC = searchParams.get('royaltyUSDC') || '';
    
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
            {/* Library 배지 */}
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

            {/* 아이콘 */}
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
              📦
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
            
            {/* 작가 */}
            <div
              style={{
                fontSize: '22px',
                color: '#6b7280',
                marginBottom: '48px',
                fontWeight: '500',
              }}
            >
              by {author.slice(0, 6)}...{author.slice(-4)}
            </div>
            
            {/* 로열티 정보 */}
            {(royaltyETH || royaltyUSDC) && (
              <div
                style={{
                  display: 'flex',
                  gap: '24px',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: '20px', color: '#6b7280', fontWeight: '500' }}>
                  Royalty:
                </div>
                {royaltyETH && parseFloat(royaltyETH) > 0 && (
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
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>
                      {royaltyETH} ETH
                    </div>
                  </div>
                )}
                {royaltyUSDC && parseFloat(royaltyUSDC) > 0 && (
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
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>
                      {royaltyUSDC} USDC
                    </div>
                  </div>
                )}
              </div>
            )}
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
            GetClayed Library
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
