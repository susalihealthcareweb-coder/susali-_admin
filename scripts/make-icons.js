// Generates the PWA icons (teal square with a white medical cross) with no dependencies.
const fs = require("fs");
const zlib = require("zlib");

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, maskable) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const pad = maskable ? 0 : size * 0.0;
  const r = size * 0.18; // corner radius
  const arm = size * (maskable ? 0.14 : 0.18), len = size * (maskable ? 0.42 : 0.56);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      let inside = true;
      if (!maskable) {
        const dx = Math.max(pad + r - x, 0, x - (size - pad - r - 1));
        const dy = Math.max(pad + r - y, 0, y - (size - pad - r - 1));
        inside = dx * dx + dy * dy <= r * r;
      }
      const cross = (Math.abs(x - c) < arm && Math.abs(y - c) < len / 2) || (Math.abs(y - c) < arm && Math.abs(x - c) < len / 2);
      const [R, G, B, A] = !inside ? [0, 0, 0, 0] : cross ? [255, 255, 255, 255] : [15, 118, 110, 255];
      raw[i] = R; raw[i + 1] = G; raw[i + 2] = B; raw[i + 3] = A;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const out = process.argv[2] || "public/icons";
fs.writeFileSync(`${out}/icon-192.png`, png(192));
fs.writeFileSync(`${out}/icon-512.png`, png(512));
fs.writeFileSync(`${out}/maskable-512.png`, png(512, true));
console.log("icons written");
