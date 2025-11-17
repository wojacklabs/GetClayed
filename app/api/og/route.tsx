import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

export async function GET() {
  try {
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
          {/* 메인 컨텐츠 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* 로고 - 지점토 구체 */}
            <div
              style={{
                width: '140px',
                height: '140px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #B8C5D6 0%, #9DB4CC 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '40px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.08)',
                border: '3px solid white',
              }}
            >
              <div
                style={{
                  width: '110px',
                  height: '110px',
                  borderRadius: '50%',
                  background: 'linear-gradient(225deg, #B8C5D6 0%, #9DB4CC 100%)',
                  boxShadow: 'inset 0 4px 8px rgba(0, 0, 0, 0.1)',
                }}
              />
            </div>
            
            {/* 앱 이름 */}
            <div
              style={{
                fontSize: '72px',
                fontWeight: '700',
                color: '#111827',
                textAlign: 'center',
                marginBottom: '16px',
                letterSpacing: '-0.02em',
              }}
            >
              GetClayed
            </div>
            
            {/* 태그라인 */}
            <div
              style={{
                fontSize: '32px',
                color: '#6b7280',
                textAlign: 'center',
                marginBottom: '60px',
                fontWeight: '500',
              }}
            >
              Sculpt like a 5-year-old genius
            </div>
            
            {/* 특징 */}
            <div
              style={{
                display: 'flex',
                gap: '24px',
                marginBottom: '48px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 24px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ fontSize: '28px' }}>👶</div>
                <div style={{ fontSize: '20px', color: '#374151', fontWeight: '600' }}>
                  Easy as Play
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 24px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ fontSize: '28px' }}>⛓️</div>
                <div style={{ fontSize: '20px', color: '#374151', fontWeight: '600' }}>
                  On-Chain
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '14px 24px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ fontSize: '28px' }}>🎨</div>
                <div style={{ fontSize: '20px', color: '#374151', fontWeight: '600' }}>
                  3D Sculpting
                </div>
              </div>
            </div>
          </div>
          
          {/* 하단 서브텍스트 */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              fontSize: '20px',
              color: '#9ca3af',
              fontWeight: '500',
            }}
          >
            getclayed.vercel.app
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800, // 3:2 aspect ratio for Farcaster (min 600x400)
      }
    );
  } catch (error) {
    console.error('OG Image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}

