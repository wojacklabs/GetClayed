import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // URL에서 프로젝트 정보 가져오기 (searchParams를 통해 전달)
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || 'Untitled Project';
    const author = searchParams.get('author') || 'Unknown';
    const likes = searchParams.get('likes') || '0';
    const views = searchParams.get('views') || '0';
    
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
          {/* 메인 콘텐츠 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* 아이콘/로고 */}
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
            
            {/* 프로젝트 이름 */}
            <div
              style={{
                fontSize: '56px',
                fontWeight: '700',
                color: '#111827',
                textAlign: 'center',
                marginBottom: '20px',
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
                fontSize: '24px',
                color: '#6b7280',
                marginBottom: '48px',
                fontWeight: '500',
              }}
            >
              by {author.slice(0, 6)}...{author.slice(-4)}
            </div>
            
            {/* 통계 */}
            <div
              style={{
                display: 'flex',
                gap: '32px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 32px',
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ fontSize: '28px' }}>❤️</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>
                  {likes}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 32px',
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ fontSize: '28px' }}>👁️</div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>
                  {views}
                </div>
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
            GetClayed
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

