// One-off icon generator. Run with: node scripts/make-icons.js
// Draws a simple dark rounded-square icon with a white play-disc glyph,
// encodes it as a real PNG using only Node's built-in zlib (no deps).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePNG(size, draw) {
  const raw = Buffer.alloc(size * (1 + size * 4)); // filter byte + RGBA per row
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y, size);
      const off = rowStart + 1 + x * 4;
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b; raw[off + 3] = a;
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// background: dark slate rounded square. glyph: white circle + dark play triangle.
function drawIcon(x, y, size) {
  const cx = size / 2, cy = size / 2;
  const bgRadius = size * 0.5;
  const cornerRadius = size * 0.22;

  // rounded-square mask for background (else transparent)
  const dx = Math.max(Math.abs(x - cx) - (bgRadius - cornerRadius), 0);
  const dy = Math.max(Math.abs(y - cy) - (bgRadius - cornerRadius), 0);
  const distOutsideCorner = Math.sqrt(dx * dx + dy * dy);
  if (distOutsideCorner > cornerRadius + 0.5) {
    return [0, 0, 0, 0];
  }

  const bg = [28, 28, 40, 255]; // dark slate
  const discR = size * 0.34;
  const dist = Math.hypot(x - cx, y - cy);

  if (dist <= discR) {
    // inside the white "disc"
    // play triangle centered, pointing right
    const triW = discR * 1.0;
    const triH = discR * 1.15;
    const px = x - cx + triW * 0.28; // shift so triangle looks centered optically
    const py = y - cy;
    const halfH = triH / 2;
    // triangle vertices: (-triW*0.35, -halfH), (-triW*0.35, halfH), (triW*0.55, 0)
    const x0 = -triW * 0.35, x1 = triW * 0.55;
    const inside = px >= x0 && px <= x1 &&
      Math.abs(py) <= halfH * (1 - (px - x0) / (x1 - x0));
    if (inside) return [28, 28, 40, 255];
    return [255, 255, 255, 255];
  }
  return bg;
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const sizes = [180, 192, 512];
for (const s of sizes) {
  const png = makePNG(s, drawIcon);
  const name = s === 180 ? 'apple-touch-icon.png' : `icon-${s}.png`;
  fs.writeFileSync(path.join(outDir, name), png);
  console.log('wrote', name, png.length, 'bytes');
}
