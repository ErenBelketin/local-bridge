const { rcedit } = require('rcedit');
const path = require('path');
const os = require('os');
const fs = require('fs');

const icoPath = path.join(__dirname, 'app_icon.ico');

function findBaseBinaries(dir) {
  let results = [];
  try {
    if (!fs.existsSync(dir)) {
      return results;
    }
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          results = results.concat(findBaseBinaries(filePath));
        } else if (file.startsWith('fetched-') && file.endsWith('-win-x64')) {
          results.push(filePath);
        }
      } catch (err) {
        console.warn(`Error scanning file ${filePath}:`, err.message);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err.message);
  }
  return results;
}

async function run() {
  try {
    const cacheDir = path.join(os.homedir(), '.pkg-cache');
    console.log('Searching for pkg base binaries in:', cacheDir);
    const binaries = findBaseBinaries(cacheDir);
    console.log('Found binaries:', binaries);
    
    if (binaries.length === 0) {
      console.log('No base binaries found in cache.');
      if (fs.existsSync(cacheDir)) {
        try {
          console.log('Cache dir contents:', fs.readdirSync(cacheDir));
        } catch (e) {}
      }
      return;
    }

    for (const binPath of binaries) {
      const dir = path.dirname(binPath);
      const filename = path.basename(binPath);
      const builtFilename = filename.replace('fetched-', 'built-');
      const builtPath = path.join(dir, builtFilename);

      console.log('Copying base binary to built path:', builtPath);
      fs.copyFileSync(binPath, builtPath);

      console.log('Patching built binary icon:', builtPath);
      try {
        await rcedit(builtPath, {
          icon: icoPath
        });
        console.log('Successfully patched built binary icon!');
      } catch (err) {
        console.error('Error patching binary:', builtPath, err);
        process.exit(1);
      }
    }
  } catch (err) {
    console.error('Fatal error in patch_cache:', err);
    process.exit(1);
  }
}

run();
