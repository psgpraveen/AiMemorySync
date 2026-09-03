import zlib from "zlib";

interface ZipEntry {
  name: string;
  content: Buffer;
}

// Precomputed CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export class SimpleZipBuilder {
  private entries: ZipEntry[] = [];

  addFile(name: string, content: string | Buffer) {
    // Normalize path separators to forward slash
    const normalizedName = name.replace(/\\/g, "/");
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf-8");
    this.entries.push({ name: normalizedName, content: buf });
  }

  build(): Buffer {
    const localHeaders: Buffer[] = [];
    const centralHeaders: Buffer[] = [];
    let offset = 0;

    const now = new Date();
    // DOS time & date format
    const dosTime =
      ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
    const dosDate =
      (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

    for (const entry of this.entries) {
      const nameBuf = Buffer.from(entry.name, "utf-8");
      const uncompressed = entry.content;
      const crc = crc32(uncompressed);
      const compressed = zlib.deflateRawSync(uncompressed, { level: 9 });

      // Local Header (30 bytes + name length)
      const localHdr = Buffer.alloc(30);
      localHdr.writeUInt32LE(0x04034b50, 0); // Local header signature
      localHdr.writeUInt16LE(20, 4); // Version needed (2.0)
      localHdr.writeUInt16LE(0, 6); // Flags
      localHdr.writeUInt16LE(8, 8); // Method: Deflate
      localHdr.writeUInt16LE(dosTime, 10);
      localHdr.writeUInt16LE(dosDate, 12);
      localHdr.writeUInt32LE(crc, 14);
      localHdr.writeUInt32LE(compressed.length, 18);
      localHdr.writeUInt32LE(uncompressed.length, 22);
      localHdr.writeUInt16LE(nameBuf.length, 26);
      localHdr.writeUInt16LE(0, 28); // Extra field length

      const localRecord = Buffer.concat([localHdr, nameBuf, compressed]);
      localHeaders.push(localRecord);

      // Central Directory Header (46 bytes + name length)
      const cdHdr = Buffer.alloc(46);
      cdHdr.writeUInt32LE(0x02014b50, 0); // Central directory signature
      cdHdr.writeUInt16LE(20, 4); // Version made by
      cdHdr.writeUInt16LE(20, 6); // Version needed
      cdHdr.writeUInt16LE(0, 8); // Flags
      cdHdr.writeUInt16LE(8, 10); // Method: Deflate
      cdHdr.writeUInt16LE(dosTime, 12);
      cdHdr.writeUInt16LE(dosDate, 14);
      cdHdr.writeUInt32LE(crc, 16);
      cdHdr.writeUInt32LE(compressed.length, 20);
      cdHdr.writeUInt32LE(uncompressed.length, 24);
      cdHdr.writeUInt16LE(nameBuf.length, 28);
      cdHdr.writeUInt16LE(0, 30); // Extra field length
      cdHdr.writeUInt16LE(0, 32); // File comment length
      cdHdr.writeUInt16LE(0, 34); // Disk number start
      cdHdr.writeUInt16LE(0, 36); // Internal attributes
      cdHdr.writeUInt32LE(0, 38); // External attributes
      cdHdr.writeUInt32LE(offset, 42); // Relative offset of local header

      centralHeaders.push(Buffer.concat([cdHdr, nameBuf]));
      offset += localRecord.length;
    }

    const cdTotalSize = centralHeaders.reduce((acc, b) => acc + b.length, 0);
    const cdOffset = offset;

    // End of Central Directory Record (22 bytes)
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
    eocd.writeUInt16LE(0, 4); // Disk number
    eocd.writeUInt16LE(0, 6); // Disk where CD starts
    eocd.writeUInt16LE(this.entries.length, 8); // Entries on disk
    eocd.writeUInt16LE(this.entries.length, 10); // Total entries
    eocd.writeUInt32LE(cdTotalSize, 12); // Size of CD
    eocd.writeUInt32LE(cdOffset, 16); // CD offset
    eocd.writeUInt16LE(0, 20); // Comment length

    return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
  }
}
