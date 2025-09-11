/**
 * PNG 프레임들을 APNG로 합치는 스크립트
 */

const UPNG = require('upng-js');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const FRAMES_DIR = path.join(__dirname, '..', 'temp_frames');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'animated-logo.png');
const FRAME_DELAY = 50; // 50ms = 20 FPS (더 빠르고 부드럽게)

async function createAPNG() {
  console.log('🎬 APNG 생성 시작...');
  
  // 프레임 파일 목록 가져오기
  const frameFiles = fs.readdirSync(FRAMES_DIR)
    .filter(f => f.endsWith('.png'))
    .sort();
  
  if (frameFiles.length === 0) {
    console.error('❌ 프레임 파일이 없습니다. 먼저 npm run generate-frames를 실행하세요.');
    process.exit(1);
  }
  
  console.log(`📋 ${frameFiles.length}개 프레임 발견`);
  
  // 각 프레임 읽기
  const frames = [];
  let width = 0;
  let height = 0;
  
  for (const file of frameFiles) {
    const filePath = path.join(FRAMES_DIR, file);
    const data = fs.readFileSync(filePath);
    const png = PNG.sync.read(data);
    
    if (width === 0) {
      width = png.width;
      height = png.height;
    }
    
    frames.push(png.data);
    console.log(`✓ ${file} 로드 완료`);
  }
  
  // APNG 생성
  console.log('\n🔄 APNG 인코딩 중...');
  const delays = new Array(frames.length).fill(FRAME_DELAY);
  const apng = UPNG.encode(frames, width, height, 256, delays); // 256 = full RGBA color
  
  // 파일 저장
  fs.writeFileSync(OUTPUT_FILE, Buffer.from(apng));
  
  console.log(`\n✅ APNG 생성 완료!`);
  console.log(`📁 위치: ${OUTPUT_FILE}`);
  console.log(`📊 크기: ${(apng.byteLength / 1024).toFixed(2)} KB`);
  console.log(`🎞️  프레임: ${frames.length}개`);
  console.log(`⏱️  FPS: ${1000 / FRAME_DELAY}`);
  
  // 임시 파일 정리 옵션
  console.log('\n💡 임시 프레임 파일을 삭제하려면:');
  console.log(`   rm -rf ${FRAMES_DIR}`);
}

createAPNG().catch(console.error);

