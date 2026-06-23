const { rcedit } = require('rcedit');
const path = require('path');

const exePath = path.join(__dirname, 'local-bridge.exe');
const icoPath = path.join(__dirname, 'app_icon.ico');

rcedit(exePath, {
  icon: icoPath
}).then(() => {
  console.log('Successfully updated local-bridge.exe icon!');
}).catch((err) => {
  console.error('Error updating icon:', err);
  process.exit(1);
});
