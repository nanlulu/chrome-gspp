// Resizes the GSheet++ icon artwork down to the sizes the manifest declares.
// Run: node scripts/make-icons.js
//
// Source of truth is assets/icon-source.png. It lives outside src/ on purpose:
// build.js copies src/icons wholesale into dist/, so a multi-megabyte master
// parked there would ship inside the extension zip.
//
// No image dependencies, same as the generator this replaced — just enough PNG
// to read one file, and a box filter. A box (area-average) filter is close to
// optimal for the >9x downscale we are doing here, and is far simpler than the
// windowed-sinc kernels that earn their keep at gentler ratios.

import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'assets/icon-source.png');
const outDir = resolve(root, 'src/icons');
const SIZES = [16, 32, 48, 128];

// Exported artwork rarely lands on exactly 0 and 255. This master sat at alpha
// 251-254 across its whole body, with ~18k stray pixels at alpha 1-8 scattered
// outside the shape. The strays are invisible on their own but a downscale
// averages them in, which is how you get a faint halo around a 16px icon.
const ALPHA_FLOOR = 16; // at or below -> fully transparent
const ALPHA_CEIL = 250; // at or above -> fully opaque

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/** Encode raw RGBA pixels (size*size*4) as a PNG buffer. */
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // One filter byte (0 = None) per scanline.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Reverse one scanline's filter, in place. */
function unfilter(type, line, prev, bpp) {
  const n = line.length;
  switch (type) {
    case 0:
      break;
    case 1:
      for (let i = bpp; i < n; i += 1) line[i] = (line[i] + line[i - bpp]) & 255;
      break;
    case 2:
      for (let i = 0; i < n; i += 1) line[i] = (line[i] + prev[i]) & 255;
      break;
    case 3:
      for (let i = 0; i < n; i += 1) {
        const a = i >= bpp ? line[i - bpp] : 0;
        line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255;
      }
      break;
    case 4:
      for (let i = 0; i < n; i += 1) {
        const a = i >= bpp ? line[i - bpp] : 0;
        const c = i >= bpp ? prev[i - bpp] : 0;
        line[i] = (line[i] + paeth(a, prev[i], c)) & 255;
      }
      break;
    default:
      throw new Error(`unsupported PNG filter type ${type}`);
  }
}

/** Decode an 8-bit RGB/RGBA PNG to flat RGBA. Enough PNG for our own asset. */
function decodePng(buffer) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((byte, i) => buffer[i] === byte)) {
    throw new Error('not a PNG');
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  let pos = 8;
  while (pos + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.toString('ascii', pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNGs are not supported');
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + length;
  }

  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(
      `unsupported PNG: bit depth ${bitDepth}, colour type ${colorType}. `
      + 'Re-export the master as 8-bit RGB or RGBA.',
    );
  }

  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rgba = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const start = y * (stride + 1);
    const filter = raw[start];
    const line = Buffer.from(raw.subarray(start + 1, start + 1 + stride));
    unfilter(filter, line, prev, channels);

    for (let x = 0; x < width; x += 1) {
      const s = x * channels;
      const d = (y * width + x) * 4;
      rgba[d] = line[s];
      rgba[d + 1] = line[s + 1];
      rgba[d + 2] = line[s + 2];
      rgba[d + 3] = channels === 4 ? line[s + 3] : 255;
    }
    prev = line;
  }

  return { width, height, rgba };
}

/** Snap near-transparent and near-opaque alpha to the extremes, in place. */
function cleanAlpha(rgba) {
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] <= ALPHA_FLOOR) rgba[i] = 0;
    else if (rgba[i] >= ALPHA_CEIL) rgba[i] = 255;
  }
}

/** Tightest box containing any non-transparent pixel. */
function contentBounds(rgba, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error('source image is fully transparent');
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Crop to `box`, then centre that on a transparent square. Squaring by padding
 * rather than stretching keeps the artwork's proportions: this master's content
 * is 1228x1192, so scaling it straight into a square would visibly squash it.
 */
function cropToSquare(rgba, width, box) {
  const side = Math.max(box.width, box.height);
  const offsetX = Math.floor((side - box.width) / 2);
  const offsetY = Math.floor((side - box.height) / 2);
  const out = Buffer.alloc(side * side * 4);

  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width; x += 1) {
      const s = ((box.y + y) * width + (box.x + x)) * 4;
      const d = ((offsetY + y) * side + (offsetX + x)) * 4;
      out[d] = rgba[s];
      out[d + 1] = rgba[s + 1];
      out[d + 2] = rgba[s + 2];
      out[d + 3] = rgba[s + 3];
    }
  }
  return { side, rgba: out };
}

/**
 * Area-average downscale to size*size.
 *
 * Source pixels are weighted by how much of them each destination pixel
 * actually covers. Snapping the sample box to whole pixels instead is simpler,
 * but 1228 does not divide by 128: some destination pixels would average 9
 * source pixels and their neighbours 10, which shows up as uneven edges.
 */
function resize(src, srcSide, size) {
  const out = Buffer.alloc(size * size * 4);
  const scale = srcSide / size;

  for (let y = 0; y < size; y += 1) {
    const top = y * scale;
    const bottom = (y + 1) * scale;

    for (let x = 0; x < size; x += 1) {
      const left = x * scale;
      const right = (x + 1) * scale;

      let r = 0;
      let g = 0;
      let b = 0;
      let alphaSum = 0;
      let weightSum = 0;

      for (let sy = Math.floor(top); sy < Math.ceil(bottom); sy += 1) {
        const wy = Math.min(sy + 1, bottom) - Math.max(sy, top);
        if (wy <= 0) continue;

        for (let sx = Math.floor(left); sx < Math.ceil(right); sx += 1) {
          const wx = Math.min(sx + 1, right) - Math.max(sx, left);
          if (wx <= 0) continue;

          const weight = wx * wy;
          const i = (sy * srcSide + sx) * 4;
          // Weight colour by alpha as well as area. Without the alpha term,
          // transparent pixels (whose RGB is arbitrary, usually black) pull the
          // average down and leave a dark fringe along every rounded edge.
          const a = src[i + 3] * weight;
          r += src[i] * a;
          g += src[i + 1] * a;
          b += src[i + 2] * a;
          alphaSum += a;
          weightSum += weight;
        }
      }

      const d = (y * size + x) * 4;
      if (alphaSum > 0) {
        out[d] = Math.round(r / alphaSum);
        out[d + 1] = Math.round(g / alphaSum);
        out[d + 2] = Math.round(b / alphaSum);
      }
      out[d + 3] = Math.round(alphaSum / weightSum);
    }
  }
  return out;
}

const decoded = decodePng(readFileSync(source));
cleanAlpha(decoded.rgba);
const box = contentBounds(decoded.rgba, decoded.width, decoded.height);
const square = cropToSquare(decoded.rgba, decoded.width, box);

console.log(
  `source ${decoded.width}x${decoded.height}`
  + ` -> content ${box.width}x${box.height} at (${box.x},${box.y})`
  + ` -> square ${square.side}x${square.side}`,
);

mkdirSync(outDir, { recursive: true });
for (const size of SIZES) {
  const file = resolve(outDir, `icon${size}.png`);
  writeFileSync(file, encodePng(size, resize(square.rgba, square.side, size)));
  console.log('wrote', file);
}
