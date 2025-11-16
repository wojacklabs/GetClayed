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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
            {/* 아이콘/로고 */}
            <div
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '30px',
                fontSize: '60px',
              }}
            >
              🏺
            </div>
            
            {/* 프로젝트 이름 */}
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
                marginBottom: '40px',
              }}
            >
              by {author.slice(0, 6)}...{author.slice(-4)}
            </div>
            
            {/* 통계 */}
            <div
              style={{
                display: 'flex',
                gap: '60px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '32px' }}>❤️</div>
                <div style={{ fontSize: '32px', fontWeight: '600', color: '#374151' }}>
                  {likes}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '32px' }}>👁️</div>
                <div style={{ fontSize: '32px', fontWeight: '600', color: '#374151' }}>
                  {views}
                </div>
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
              3D Clay Sculpting
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

