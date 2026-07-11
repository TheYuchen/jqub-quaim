// Minimal ZIP writer, STORE method only — pure JS, zero dependencies.
//
// Why hand-rolled: the figure exporter bundles up to three small
// artifacts (SVG, PNG, provenance JSON) into ONE download so a single
// camera click can never trip a browser's multi-download blocking
// (audit backlog: the old triple download silently lost the sidecar
// and/or PNG on strict settings). SVG + JSON are tiny and PNG bytes
// are already Deflate-compressed, so STORE gives up nothing worth a
// dependency. Layout per PKWARE APPNOTE: [local file header + data]*,
// central directory, end-of-central-directory record. CRC-32 is the
// standard reflected 0xEDB88320 table algorithm — verified against
// the canonical "123456789" → 0xCBF43926 check value, and the whole
// writer is read back by python's zipfile, in scripts/check_zip.test.ts.

export interface ZipEntry {
  /** Path inside the archive (forward slashes; UTF-8 flag is set). */
  name: string;
  data: Uint8Array;
}

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++)
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** DOS date/time pair (2-second resolution) — what ZIP headers store. */
function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date:
      ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Build a ZIP archive (STORE method) from named byte entries.
 *  `now` is injectable so the node lane can build a byte-stable
 *  fixture. */
export function buildZip(
  entries: ZipEntry[],
  now: Date = new Date(),
): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const { time, date } = dosDateTime(now);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0; // running local-header offset = central "offset" field
  for (const { name, data } of entries) {
    const nameB = enc.encode(name);
    const crc = crc32(data);
    // The 24-byte run shared by both record types: version-needed,
    // flags, method, time, date, crc, csize, usize, name length.
    const common = (v: DataView, at: number) => {
      v.setUint16(at, 20, true); // version needed: 2.0
      v.setUint16(at + 2, 0x0800, true); // gp flag: UTF-8 names
      v.setUint16(at + 4, 0, true); // method: STORE
      v.setUint16(at + 6, time, true);
      v.setUint16(at + 8, date, true);
      v.setUint32(at + 10, crc, true);
      v.setUint32(at + 14, data.length, true); // compressed = raw (STORE)
      v.setUint32(at + 18, data.length, true); // uncompressed
      v.setUint16(at + 22, nameB.length, true);
    };
    const local = new Uint8Array(30 + nameB.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header signature
    common(lv, 4); // extra-len at 28 stays 0
    local.set(nameB, 30);
    local.set(data, 30 + nameB.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameB.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); // central directory signature
    cv.setUint16(4, 20, true); // version made by
    common(cv, 6);
    // extra/comment lengths, disk#, internal + external attrs (bytes
    // 30..41) stay zero; offset of the local header:
    cv.setUint32(42, offset, true);
    central.set(nameB, 46);
    centrals.push(central);
    offset += local.length;
  }
  const cdSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // EOCD signature
  ev.setUint16(8, entries.length, true); // entries on this disk
  ev.setUint16(10, entries.length, true); // entries total
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true); // central directory offset
  const out = new Uint8Array(offset + cdSize + 22);
  let at = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
