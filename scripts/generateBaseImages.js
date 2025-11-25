const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

async function generateImages() {
  const publicDir = path.join(__dirname, '..', 'public');
  
  // Load the existing 512x512 icon
  const iconPath = path.join(publicDir, 'icon-512x512.png');
  const icon = await loadImage(iconPath);
  
  // 1. Generate 1024x1024 icon (upscale from 512)
  console.log('Generating icon-1024x1024.png...');
  const icon1024 = createCanvas(1024, 1024);
  const ctx1024 = icon1024.getContext('2d');
  
  // Fill with white background (no alpha)
  ctx1024.fillStyle = '#FFFFFF';
  ctx1024.fillRect(0, 0, 1024, 1024);
  
  // Draw the icon scaled up
  ctx1024.drawImage(icon, 0, 0, 1024, 1024);
  
  // Save as PNG
  const icon1024Buffer = icon1024.toBuffer('image/png');
  fs.writeFileSync(path.join(publicDir, 'icon-1024x1024.png'), icon1024Buffer);
  console.log('✅ icon-1024x1024.png created');
  
  // 2. Generate OG image (1200x630)
  console.log('Generating og-image.png...');
  const ogCanvas = createCanvas(1200, 630);
  const ogCtx = ogCanvas.getContext('2d');
  
  // Dark gradient background
  const gradient = ogCtx.createLinearGradient(0, 0, 1200, 630);
  gradient.addColorStop(0, '#0a0a0a');
  gradient.addColorStop(0.5, '#1a1a2e');
  gradient.addColorStop(1, '#16213e');
  ogCtx.fillStyle = gradient;
  ogCtx.fillRect(0, 0, 1200, 630);
  
  // Add subtle grid pattern
  ogCtx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ogCtx.lineWidth = 1;
  for (let i = 0; i < 1200; i += 40) {
    ogCtx.beginPath();
    ogCtx.moveTo(i, 0);
    ogCtx.lineTo(i, 630);
    ogCtx.stroke();
  }
  for (let i = 0; i < 630; i += 40) {
    ogCtx.beginPath();
    ogCtx.moveTo(0, i);
    ogCtx.lineTo(1200, i);
    ogCtx.stroke();
  }
  
  // Draw the clay ball icon (centered left area)
  const iconSize = 280;
  const iconX = 120;
  const iconY = (630 - iconSize) / 2;
  
  // Add glow effect behind icon
  ogCtx.shadowColor = 'rgba(100, 150, 200, 0.5)';
  ogCtx.shadowBlur = 60;
  ogCtx.drawImage(icon, iconX, iconY, iconSize, iconSize);
  ogCtx.shadowBlur = 0;
  
  // Add text
  ogCtx.fillStyle = '#FFFFFF';
  ogCtx.font = 'bold 72px Arial, sans-serif';
  ogCtx.fillText('GetClayed', 480, 260);
  
  ogCtx.fillStyle = '#a0a0a0';
  ogCtx.font = '32px Arial, sans-serif';
  ogCtx.fillText('3D creation made simple', 480, 320);
  
  ogCtx.fillStyle = '#6b7280';
  ogCtx.font = '24px Arial, sans-serif';
  ogCtx.fillText('No Blender, Just Clay', 480, 380);
  
  // Add accent line
  ogCtx.strokeStyle = '#3b82f6';
  ogCtx.lineWidth = 4;
  ogCtx.beginPath();
  ogCtx.moveTo(480, 400);
  ogCtx.lineTo(700, 400);
  ogCtx.stroke();
  
  // Save OG image
  const ogBuffer = ogCanvas.toBuffer('image/png');
  fs.writeFileSync(path.join(publicDir, 'og-image.png'), ogBuffer);
  console.log('✅ og-image.png created');
  
  console.log('\n🎉 All images generated successfully!');
  console.log('Files created:');
  console.log('  - public/icon-1024x1024.png (1024x1024)');
  console.log('  - public/og-image.png (1200x630)');
}

generateImages().catch(console.error);

