import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// 캐시 무효화를 위한 revalidate 설정
export const revalidate = 0;

export async function GET(_request: NextRequest) {
  try {
    // 버전 파라미터는 캐시 버스팅용으로 URL에만 사용됨 (v=3 등)
    
    const response = new ImageResponse(
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
          {/* 메인 컨텐츠 - 작은 크기로 중앙 배치 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'white',
              borderRadius: '32px',
              padding: '60px 80px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.06)',
              border: '1px solid #e5e7eb',
              maxWidth: '800px',
            }}
          >
            {/* 로고 - 지점토 구체 */}
            <div
              style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #B8C5D6 0%, #9DB4CC 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '28px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
                border: '2px solid #f9fafb',
              }}
            >
              <div
                style={{
                  width: '78px',
                  height: '78px',
                  borderRadius: '50%',
                  background: 'linear-gradient(225deg, #B8C5D6 0%, #9DB4CC 100%)',
                  boxShadow: 'inset 0 3px 6px rgba(0, 0, 0, 0.1)',
                }}
              />
            </div>
            
            {/* 앱 이름 */}
            <div
              style={{
                fontSize: '56px',
                fontWeight: '700',
                color: '#111827',
                textAlign: 'center',
                marginBottom: '12px',
                letterSpacing: '-0.02em',
              }}
            >
              GetClayed
            </div>
            
            {/* 태그라인 */}
            <div
              style={{
                fontSize: '24px',
                color: '#6b7280',
                textAlign: 'center',
                marginBottom: '40px',
                fontWeight: '500',
              }}
            >
              Sculpt like a 5-year-old genius
            </div>
            
            {/* 특징 */}
            <div
              style={{
                display: 'flex',
                gap: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontSize: '20px' }}>👶</div>
                <div style={{ fontSize: '16px', color: '#374151', fontWeight: '600' }}>
                  Easy
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontSize: '20px' }}>⛓️</div>
                <div style={{ fontSize: '16px', color: '#374151', fontWeight: '600' }}>
                  On-Chain
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ fontSize: '20px' }}>🎨</div>
                <div style={{ fontSize: '16px', color: '#374151', fontWeight: '600' }}>
                  3D
                </div>
              </div>
            </div>
          </div>
          
          {/* 하단 서브텍스트 */}
          <div
            style={{
              marginTop: '32px',
              fontSize: '18px',
              color: '#9ca3af',
              fontWeight: '500',
            }}
          >
            getclayed.io
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800, // 3:2 aspect ratio for Farcaster (min 600x400)
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
          'CDN-Cache-Control': 'public, max-age=3600',
          'Vercel-CDN-Cache-Control': 'public, max-age=3600',
        },
      }
    );
    
    return response;
  } catch (error) {
    console.error('OG Image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}

