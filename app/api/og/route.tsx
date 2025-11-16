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
            {/* 로고 */}
            <div
              style={{
                width: '140px',
                height: '140px',
                borderRadius: '28px',
                backgroundColor: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '40px',
                fontSize: '80px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.08)',
                border: '1px solid #e5e7eb',
              }}
            >
              🏺
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
                gap: '32px',
                marginBottom: '48px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 28px',
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ fontSize: '32px' }}>🎨</div>
                <div style={{ fontSize: '22px', color: '#374151', fontWeight: '600' }}>
                  Easy to Use
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 28px',
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ fontSize: '32px' }}>⛓️</div>
                <div style={{ fontSize: '22px', color: '#374151', fontWeight: '600' }}>
                  On-Chain
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 28px',
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ fontSize: '32px' }}>✨</div>
                <div style={{ fontSize: '22px', color: '#374151', fontWeight: '600' }}>
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
        height: 630,
      }
    );
  } catch (error) {
    console.error('OG Image generation error:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}

