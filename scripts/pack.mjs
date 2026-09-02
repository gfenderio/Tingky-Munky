// Membuat bot.zip berisi HANYA berkas yang dibutuhkan Discloud, dengan semua
// entri di ROOT arsip (Discloud menolak zip yang isinya dibungkus satu folder).
// banner.png (2.5 MB, cuma buat README) sengaja tidak ikut.
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { deflateRawSync, crc32 } from 'node:zlib';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'bot.zip');

const ENTRIES = [
  'index.js',
  'package.json',
  'discloud.config',
  '.env',
  'assets/asds.png',
  'assets/asik.png',
  'assets/eskrim.png',
  'assets/jumatan.jpg',
];

for (const name of ENTRIES) {
  if (!existsSync(join(ROOT, name))) {
    console.error(`[pack] Berkas wajib hilang: ${name}`);
    process.exit(1);
  }
}

const locals = [];
const central = [];
let offset = 0;

for (const name of ENTRIES) {
  const raw = readFileSync(join(ROOT, name));
  const deflated = deflateRawSync(raw, { level: 9 });
  const useDeflate = deflated.length < raw.length;
  const body = useDeflate ? deflated : raw;
  const method = useDeflate ? 8 : 0;
  const crc = crc32(raw) >>> 0;
  const nameBuf = Buffer.from(name, 'utf8');

  const local = Buffer.alloc(30 + nameBuf.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0, 6); // flags
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(0, 10); // time
  local.writeUInt16LE(0x21, 12); // date (1980-01-01)
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  nameBuf.copy(local, 30);
  locals.push(local, body);

  const cd = Buffer.alloc(46 + nameBuf.length);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4); // version made by
  cd.writeUInt16LE(20, 6); // version needed
  cd.writeUInt16LE(0, 8);
  cd.writeUInt16LE(method, 10);
  cd.writeUInt16LE(0, 12);
  cd.writeUInt16LE(0x21, 14);
  cd.writeUInt32LE(crc, 16);
  cd.writeUInt32LE(body.length, 20);
  cd.writeUInt32LE(raw.length, 24);
  cd.writeUInt16LE(nameBuf.length, 28);
  cd.writeUInt32LE(0, 30); // extra + comment len
  cd.writeUInt16LE(0, 34); // disk
  cd.writeUInt16LE(0, 36); // internal attrs
  cd.writeUInt32LE((0o100644 * 0x10000) >>> 0, 38); // external attrs (rw-r--r--)
  cd.writeUInt32LE(offset, 42);
  nameBuf.copy(cd, 46);
  central.push(cd);

  offset += local.length + body.length;
}

const cdBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(ENTRIES.length, 8);
end.writeUInt16LE(ENTRIES.length, 10);
end.writeUInt32LE(cdBuf.length, 12);
end.writeUInt32LE(offset, 16);

writeFileSync(OUT, Buffer.concat([...locals, cdBuf, end]));
console.log(`[pack] bot.zip siap — ${ENTRIES.length} berkas, ${(statSync(OUT).size / 1024 / 1024).toFixed(2)} MB`);
