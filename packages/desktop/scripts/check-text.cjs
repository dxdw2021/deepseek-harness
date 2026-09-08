const fs = require('fs');
const path = require('path');
const dir = 'D:/DEV/tool/AI/deepseek-harness/apps/web/dist/assets';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
for (const f of files) {
  const buf = fs.readFileSync(path.join(dir, f));
  // Search for bytes of Chinese characters
  const previewBytes = Buffer.from([0xe9, 0x88, 0x84, 0xe8, 0xa7, 0x88, 0xe7, 0x89, 0x88]); // 预览版
  const flagshipBytes = Buffer.from([0xe6, 0x97, 0x97, 0xe8, 0x88, 0xb0, 0xe7, 0x89, 0x88]); // 旗舰版
  const hasPreview = buf.includes(previewBytes);
  const hasFlagship = buf.includes(flagshipBytes);
  console.log(f + ':');
  if (hasPreview) console.log('  FOUND preview');
  if (hasFlagship) console.log('  FOUND flagship');
  if (!hasPreview && !hasFlagship) console.log('  Neither found (text may be in CSS or separate chunk)');
}
// Also check CSS files
const cssFiles = fs.readdirSync(dir).filter(f => f.endsWith('.css'));
for (const f of cssFiles) {
  const buf = fs.readFileSync(path.join(dir, f));
  const previewBytes = Buffer.from([0xe9, 0x88, 0x84, 0xe8, 0xa7, 0x88, 0xe7, 0x89, 0x88]);
  const flagshipBytes = Buffer.from([0xe6, 0x97, 0x97, 0xe8, 0x88, 0xb0, 0xe7, 0x89, 0x88]);
  if (buf.includes(previewBytes)) console.log(f + ': FOUND preview');
  if (buf.includes(flagshipBytes)) console.log(f + ': FOUND flagship');
}
