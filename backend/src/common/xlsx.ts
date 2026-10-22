import { deflateRawSync, inflateRawSync } from "node:zlib";

/**
 * A spreadsheet in and out, with nothing but Node. Reads the first sheet of an .xlsx (a zip of XML) or a CSV; writes a plain one-sheet
 * .xlsx. Enough for a school to download a template, fill it in Excel and bring it back — not a spreadsheet library.
 */

export type Cell = string | number | null;

/* ───────────────────────── zip ───────────────────────── */

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
const crc32 = (buffer: Buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function readZip(buffer: Buffer): Map<string, Buffer> {
  // End of central directory: the last 22+ bytes, signature 0x06054b50.
  let eocd = -1;
  for (let at = buffer.length - 22; at >= Math.max(0, buffer.length - 66_000); at -= 1) {
    if (buffer.readUInt32LE(at) === 0x06054b50) { eocd = at; break; }
  }
  if (eocd < 0) throw new Error("That is not an Excel (.xlsx) file.");
  const count = buffer.readUInt16LE(eocd + 10);
  let at = buffer.readUInt32LE(eocd + 16);
  const files = new Map<string, Buffer>();
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(at) !== 0x02014b50) throw new Error("That Excel file is damaged.");
    const method = buffer.readUInt16LE(at + 10);
    const compressed = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const offset = buffer.readUInt32LE(at + 42);
    const name = buffer.toString("utf8", at + 46, at + 46 + nameLength);
    const local = offset;
    const dataStart = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const raw = buffer.subarray(dataStart, dataStart + compressed);
    if (/\.(xml|rels)$/i.test(name)) files.set(name, method === 0 ? raw : method === 8 ? inflateRawSync(raw) : Buffer.alloc(0));
    at += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function writeZip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const packed = deflateRawSync(file.data);
    const crc = crc32(file.data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0, 6); header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0, 10); header.writeUInt16LE(0x21, 12); header.writeUInt32LE(crc, 14); header.writeUInt32LE(packed.length, 18); header.writeUInt32LE(file.data.length, 22);
    header.writeUInt16LE(name.length, 26); header.writeUInt16LE(0, 28);
    parts.push(header, name, packed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0, 8); entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(0, 12); entry.writeUInt16LE(0x21, 14); entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(packed.length, 20); entry.writeUInt32LE(file.data.length, 24);
    entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += header.length + name.length + packed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}

/* ───────────────────────── xml bits ───────────────────────── */

const unescapeXml = (value: string) => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code))).replace(/&amp;/g, "&");
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const text = (xml: string) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => unescapeXml(match[1]!)).join("");
const columnIndex = (ref: string) => {
  let n = 0;
  for (const char of ref.replace(/[0-9]/g, "")) n = n * 26 + (char.charCodeAt(0) - 64);
  return n - 1;
};
const columnName = (index: number) => {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
};

/* ───────────────────────── reading ───────────────────────── */

export function readXlsx(buffer: Buffer): Cell[][] {
  const files = readZip(buffer);
  const shared = files.get("xl/sharedStrings.xml");
  const strings = shared ? [...shared.toString("utf8").matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((match) => text(match[1]!)) : [];
  const sheetName = [...files.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")))[0];
  if (!sheetName) throw new Error("That Excel file has no sheet to read.");
  const xml = files.get(sheetName)!.toString("utf8");
  const rows: Cell[][] = [];
  for (const rowMatch of xml.matchAll(/<row[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row: Cell[] = [];
    for (const cellMatch of (rowMatch[1] ?? "").matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1]!;
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /t="([a-zA-Z]+)"/.exec(attrs)?.[1];
      const body = cellMatch[2] ?? "";
      let value: Cell = null;
      if (type === "inlineStr") value = text(body);
      else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (v !== undefined) value = type === "s" ? strings[Number(v)] ?? "" : type === "str" || type === "b" || type === "e" ? unescapeXml(v) : Number(v);
      }
      const index = ref ? columnIndex(ref) : row.length;
      while (row.length < index) row.push(null);
      row[index] = value;
    }
    rows.push(row);
  }
  return rows;
}

/** A CSV as Excel saves it: quoted fields, doubled quotes, commas or semicolons, a possible byte-order mark. */
export function readCsv(content: string): Cell[][] {
  const textContent = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const first = textContent.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = "";
  let quoted = false;
  const push = () => { row.push(field === "" ? null : field); field = ""; };
  for (let at = 0; at < textContent.length; at += 1) {
    const char = textContent[at]!;
    if (quoted) {
      if (char === '"') { if (textContent[at + 1] === '"') { field += '"'; at += 1; } else quoted = false; } else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) push();
    else if (char === "\n" || char === "\r") { if (char === "\r" && textContent[at + 1] === "\n") at += 1; push(); rows.push(row); row = []; }
    else field += char;
  }
  if (field !== "" || row.length) { push(); rows.push(row); }
  return rows.filter((entry) => entry.some((cell) => cell !== null));
}

/** Whatever the person uploaded: an .xlsx, or a CSV saved from Excel. */
export function readSpreadsheet(buffer: Buffer): Cell[][] {
  return buffer.length > 3 && buffer[0] === 0x50 && buffer[1] === 0x4b ? readXlsx(buffer) : readCsv(buffer.toString("utf8"));
}

/* ───────────────────────── writing ───────────────────────── */

export function writeXlsx(rows: Cell[][], sheetName = "Sheet1", widths: number[] = []): Buffer {
  const cols = widths.length ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>` : "";
  const sheetRows = rows.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => {
    if (cell === null || cell === "") return "";
    const ref = `${columnName(c)}${r + 1}`;
    return typeof cell === "number" ? `<c r="${ref}"><v>${cell}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${sheetRows}</sheetData></worksheet>`;
  const files = [
    { name: "[Content_Types].xml", xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
    { name: "_rels/.rels", xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { name: "xl/worksheets/sheet1.xml", xml: sheet },
  ];
  return writeZip(files.map((file) => ({ name: file.name, data: Buffer.from(file.xml, "utf8") })));
}
