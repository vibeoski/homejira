const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'assets', 'logo.svg');
const iconPath = path.join(__dirname, 'assets', 'icon.png');
const splashPath = path.join(__dirname, 'assets', 'splash.png');

async function generate() {
  console.log('Generating PNG assets from SVG...');
  
  // Icon: 1024x1024 PNG
  await sharp(svgPath)
    .resize(1024, 1024)
    .png()
    .toFile(iconPath);
  console.log('✔ Generated icon.png');

  // Splash: 2732x2732 PNG (centered logo on background)
  // Background color #6366f1
  await sharp({
    create: {
      width: 2732,
      height: 2732,
      channels: 4,
      background: { r: 99, g: 102, b: 241, alpha: 1 }
    }
  })
    .composite([{ input: svgPath, blend: 'over', top: 854, left: 854 }]) // center 1024 inside 2732
    .png()
    .toFile(splashPath);
  console.log('✔ Generated splash.png');
}

generate().catch(console.error);
