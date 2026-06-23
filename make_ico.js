const fs = require('fs');
const path = require('path');

const pngPath = path.join(__dirname, 'app_icon.png');
const icoPath = path.join(__dirname, 'app_icon.ico');

if (!fs.existsSync(pngPath)) {
  console.error('Error: app_icon.png not found!');
  process.exit(1);
}

const pngBuffer = fs.readFileSync(pngPath);
const pngSize = pngBuffer.length;

const icoHeader = Buffer.alloc(22);
// Header
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // Type 1 (Icon)
icoHeader.writeUInt16LE(1, 4); // Number of images (1)

// Directory Entry
icoHeader.writeUInt8(0, 6); // Width (256)
icoHeader.writeUInt8(0, 7); // Height (256)
icoHeader.writeUInt8(0, 8); // Color palette
icoHeader.writeUInt8(0, 9); // Reserved
icoHeader.writeUInt16LE(1, 10); // Color planes
icoHeader.writeUInt16LE(32, 12); // Bits per pixel (32)
icoHeader.writeUInt32LE(pngSize, 14); // Size of PNG data
icoHeader.writeUInt32LE(22, 18); // Offset (Header + Directory Entry = 22 bytes)

const icoBuffer = Buffer.concat([icoHeader, pngBuffer]);
fs.writeFileSync(icoPath, icoBuffer);
console.log('Successfully created app_icon.ico');
