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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {/* 메인 로고 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '40px',
            }}
          >
            <div
              style={{
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '40px',
                fontSize: '120px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              }}
            >
              🏺
            </div>
            
            {/* 앱 이름 */}
            <div
              style={{
                fontSize: '96px',
                fontWeight: 'bold',
                color: 'white',
                textAlign: 'center',
                marginBottom: '20px',
                textShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              }}
            >
              GetClayed
            </div>
            
            {/* 태그라인 */}
            <div
              style={{
                fontSize: '42px',
                color: 'rgba(255, 255, 255, 0.9)',
                textAlign: 'center',
                marginBottom: '50px',
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
              }}
            >
              3D Clay Sculpting in Your Browser
            </div>
          </div>
          
          {/* 기능 아이콘들 */}
          <div
            style={{
              display: 'flex',
              gap: '50px',
              marginBottom: '50px',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '50px',
                }}
              >
                ✨
              </div>
              <div style={{ fontSize: '24px', color: 'white' }}>Create</div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '50px',
                }}
              >
                🎨
              </div>
              <div style={{ fontSize: '24px', color: 'white' }}>Sculpt</div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '50px',
                }}
              >
                🚀
              </div>
              <div style={{ fontSize: '24px', color: 'white' }}>Share</div>
            </div>
          </div>
          
          {/* Web3 배지 */}
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              fontSize: '28px',
              fontWeight: '600',
              padding: '16px 48px',
              borderRadius: '32px',
              backdropFilter: 'blur(10px)',
            }}
          >
            Powered by Web3 & Blockchain
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

