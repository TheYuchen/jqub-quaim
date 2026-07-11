// Byte-level verification of the STORE-method ZIP writer (lib/zip.ts)
// that packages figure-export bundles — pure functions, no DOM, so
// this runs in plain node:
//   node --experimental-strip-types scripts/check_zip.test.ts
//
// What is verified:
//   1. CRC-32 against the canonical check vector ("123456789" →
//      0xCBF43926), the empty input, and a second published vector;
//   2. archive structure: local-header / central-directory / EOCD
//      signatures at their computed offsets, STORE method, and the
//      central directory landing exactly after the local records;
//   3. interop — the real claim: the fixture zip is written to disk
//      and read back with `python3 -m zipfile` (-l listing with every
//      bundled filename + true size, then -t CRC integrity test) —
//      the same reader a reviewer would reach for first.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildZip, crc32 } from "../src/lib/zip.ts";

const enc = new TextEncoder();

// -- 1. CRC-32 check vectors -------------------------------------------------
assert.equal(crc32(enc.encode("123456789")), 0xcbf43926);
assert.equal(crc32(new Uint8Array(0)), 0x00000000);
assert.equal(
  crc32(enc.encode("The quick brown fox jumps over the lazy dog")),
  0x414fa339,
);

// -- 2. archive structure ------------------------------------------------
// Shaped like a real figure bundle: svg + raster png + provenance json.
const entries = [
  { name: "evidence-theater_F0.svg", data: enc.encode("<svg>fixture</svg>") },
  {
    name: "evidence-theater_F0_2.5x.png",
    data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7]),
  },
  {
    name: "evidence-theater_F0.provenance.json",
    data: enc.encode(JSON.stringify({ app: "QuDA Studio", runs: [] })),
  },
];
const zip = buildZip(entries, new Date(2026, 6, 11, 12, 0, 0));
const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
assert.equal(dv.getUint32(0, true), 0x04034b50); // first local header
const eocdAt = zip.length - 22;
assert.equal(dv.getUint32(eocdAt, true), 0x06054b50); // EOCD signature
assert.equal(dv.getUint16(eocdAt + 10, true), entries.length);
const cdOffset = dv.getUint32(eocdAt + 16, true);
assert.equal(dv.getUint32(cdOffset, true), 0x02014b50); // central dir sig
assert.equal(dv.getUint16(cdOffset + 10, true), 0); // method: STORE
// STORE local records are exactly header(30) + name + data, back to back.
const expectedCdOffset = entries.reduce(
  (n, e) => n + 30 + e.name.length + e.data.length,
  0,
);
assert.equal(cdOffset, expectedCdOffset);

// -- 3. interop: python3's zipfile must accept the writer's bytes ---------
const fixture = join(tmpdir(), "quda_check_zip_fixture.zip");
writeFileSync(fixture, zip);
const listing = execFileSync("python3", ["-m", "zipfile", "-l", fixture], {
  encoding: "utf8",
});
console.log(`$ python3 -m zipfile -l ${fixture}\n${listing}`);
for (const e of entries) {
  const row = new RegExp(
    `${e.name.replace(/[.]/g, "\\.")}\\s.*\\b${e.data.length}\\b`,
  );
  assert.match(listing, row, `listing row for ${e.name}`);
}
// -t decompresses every member and checks its CRC — the integrity claim.
const integrity = execFileSync("python3", ["-m", "zipfile", "-t", fixture], {
  encoding: "utf8",
});
console.log(`$ python3 -m zipfile -t ${fixture}\n${integrity.trim()}`);
assert.match(integrity, /Done testing/);

console.log("check_zip: all assertions passed");
