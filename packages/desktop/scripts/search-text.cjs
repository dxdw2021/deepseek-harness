// Deep search for Chinese characters in all JS files
const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      searchDir(fullPath);
    } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.map')) {
      const buf = fs.readFileSync(fullPath);
      // 预 = E9 88 84, 旗 = E6 97 97
      const previewBuf = Buffer.from([0xe9, 0x88, 0x84]);
      const flagshipBuf = Buffer.from([0xe6, 0x97, 0x97]);
      if (buf.includes(previewBuf)) console.log('FOUND 预 in: ' + path.relative('D:/DEV/tool/AI/deepseek-harness', fullPath));
      if (buf.includes(flagshipBuf)) console.log('FOUND 旗 in: ' + path.relative('D:/DEV/tool/AI/deepseek-harness', fullPath));
    }
  }
}

// Check the entire dist
searchDir('D:/DEV/tool/AI/deepseek-harness/apps/web/dist');

// Also check lib directories of client packages
const clientDir = 'D:/DEV/tool/AI/deepseek-harness/packages/client/ui-conversation/lib';
if (fs.existsSync(clientDir)) {
  console.log('\n--- ui-conversation lib ---');
  searchDir(clientDir);
} else {
  console.log('\nui-conversation lib not found');
}

// Check the bundle output
const bundleDir = 'D:/DEV/tool/AI/deepseek-harness/packages/bundle/web-app/lib';
if (fs.existsSync(bundleDir)) {
  console.log('\n--- web-app bundle lib ---');
  searchDir(bundleDir);
}
