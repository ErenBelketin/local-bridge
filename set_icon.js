const { rcedit } = require('rcedit');
const path = require('path');

const exePath = path.join(__dirname, 'local-bridge.exe');
const icoPath = path.join(__dirname, 'app_icon.ico');

async function run() {
  console.log('Waiting 3 seconds for file locks to clear...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  let attempts = 3;
  while (attempts > 0) {
    try {
      await rcedit(exePath, {
        icon: icoPath
      });
      console.log('Successfully updated local-bridge.exe icon!');
      return;
    } catch (err) {
      attempts--;
      if (attempts === 0) {
        console.error('Error updating icon after retries:', err);
        process.exit(1);
      }
      console.log(`Failed to update icon, retrying in 2 seconds... (${attempts} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

run();
