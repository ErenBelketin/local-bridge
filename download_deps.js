import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = 'https://cdn.jsdelivr.net/gh/davidshimjs/qrcodejs/qrcode.min.js';
const dest = path.join(__dirname, 'public', 'qrcode.min.js');

console.log('Downloading qrcode.min.js locally for offline support...');
https.get(url, (res) => {
  if (res.statusCode !== 200) {
    console.error(`Request failed with status code: ${res.statusCode}`);
    return;
  }
  const fileStream = fs.createWriteStream(dest);
  res.pipe(fileStream);
  fileStream.on('finish', () => {
    fileStream.close();
    console.log('✅ qrcode.min.js downloaded successfully and saved locally!');
  });
}).on('error', (err) => {
  console.error('❌ Download failed:', err.message);
});
