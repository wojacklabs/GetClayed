import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';
export const alt = 'GetClayed Project';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // 프로젝트 정보를 실제로 가져오는 것은 edge runtime에서 제한이 있으므로
  // API를 통해 리다이렉트합니다
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
          fontFamily: 'sans-serif',
        }}
      >
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
          }}
        >
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
          <div
            style={{
              fontSize: '56px',
              fontWeight: 'bold',
              color: '#1f2937',
              textAlign: 'center',
              marginBottom: '20px',
            }}
          >
            GetClayed Project
          </div>
          <div
            style={{
              fontSize: '28px',
              color: '#6b7280',
              marginBottom: '20px',
            }}
          >
            ID: {id}
          </div>
        </div>
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
      ...size,
    }
  );
}

