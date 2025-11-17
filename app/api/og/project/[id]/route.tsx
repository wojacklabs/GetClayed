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
            padding: '80px 100px',
          }}
        >
          {/* 메인 콘텐츠 - 화이트 카드로 감싸기 */}
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
            {/* 아이콘/로고 - 지점토 구체 */}
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
            
            {/* 프로젝트 이름 */}
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
            
            {/* 작가 */}
            <div
              style={{
                fontSize: '18px',
                color: '#6b7280',
                marginBottom: '32px',
                fontWeight: '500',
              }}
            >
              by {author.slice(0, 6)}...{author.slice(-4)}
            </div>
            
            {/* 통계 */}
            <div
              style={{
                display: 'flex',
                gap: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontSize: '20px' }}>❤️</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                  {likes}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontSize: '20px' }}>👁️</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                  {views}
                </div>
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

