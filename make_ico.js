const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico').default;

const pngPath = path.join(__dirname, 'app_icon.png');
const icoPath = path.join(__dirname, 'app_icon.ico');

if (!fs.existsSync(pngPath)) {
  console.error('Error: app_icon.png not found!');
  process.exit(1);
}

pngToIco(pngPath)
  .then(buf => {
    fs.writeFileSync(icoPath, buf);
    console.log('Successfully created multi-size app_icon.ico');
  })
  .catch(err => {
    console.error('Error generating ICO:', err);
    process.exit(1);
  });
