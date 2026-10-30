// ตรวจว่าแอปติดตั้งเป็น PWA บนมือถือได้ (manifest + ไอคอน)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));

// อ่านขนาดจริงจาก header ของไฟล์ PNG (IHDR: width/height ที่ byte 16-23)
function pngSize(path) {
  const buf = fs.readFileSync(path);
  assert.equal(buf.toString('hex', 0, 8), '89504e470d0a1a0a', `${path} ไม่ใช่ PNG`);
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
}

test('index.html ลิงก์ manifest และ apple-touch-icon', () => {
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/);
});

test('manifest มีฟิลด์ที่ Chrome ต้องใช้ในการติดตั้ง', () => {
  assert.equal(manifest.name, 'บันทึกกระแสเงินสด');
  assert.equal(manifest.short_name, 'กระแสเงินสด');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.background_color, '#05050a');
  assert.equal(manifest.theme_color, '#05050a');
  const sizes = manifest.icons.filter(i => i.purpose !== 'maskable').map(i => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  assert.ok(manifest.icons.some(i => i.purpose === 'maskable' && i.sizes === '512x512'));
});

test('ไฟล์ไอคอนทุกไฟล์มีอยู่จริงและขนาดตรงกับที่ประกาศ', () => {
  for (const icon of manifest.icons) {
    assert.equal(icon.type, 'image/png');
    assert.equal(pngSize(icon.src), icon.sizes, icon.src);
  }
  assert.equal(pngSize('icons/apple-touch-icon.png'), '180x180');
});
