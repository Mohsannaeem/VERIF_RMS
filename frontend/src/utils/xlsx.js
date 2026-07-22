// ── Excel workbook generation — client-side, lazily loaded ────────────────────
import { downloadBlob } from './csv.js';

/** Characters Excel forbids in a worksheet name, plus the 31-char cap. */
const ILLEGAL_SHEET_CHARS = /[:\\/?*[\]]/g;

/**
 * Coerce an arbitrary string into a legal, unique worksheet name.
 * Excel rejects names over 31 chars, containing : \ / ? * [ ], leading/trailing
 * apostrophes, or duplicates (compared case-insensitively).
 * `used` is a Set of already-claimed lowercased names and is mutated.
 */
export function sheetName(raw, used) {
  let base = String(raw ?? '').replace(ILLEGAL_SHEET_CHARS, '_').replace(/^'+|'+$/g, '').trim();
  if (!base) base = 'Sheet';
  base = base.slice(0, 31);

  let name = base;
  for (let n = 2; used.has(name.toLowerCase()); n++) {
    const suffix = `~${n}`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name.toLowerCase());
  return name;
}

/**
 * Translate our neutral field definitions into write-excel-file v4 `columns`.
 * Each cell carries its own type; blank values become `null` so the cell is
 * genuinely empty rather than a zero or the string "undefined".
 */
const toColumnDefs = fields => fields.map(f => ({
  header: { value: f.column, fontWeight: 'bold' },
  width:  f.width,
  cell:   (row) => {
    const v = row[f.column];
    if (v == null || v === '') return null;
    return { value: f.type === String ? String(v) : v, type: f.type, format: f.format };
  },
}));

/**
 * Build and download a multi-sheet .xlsx.
 * `sheets` is [{ name, rows, fields }] — one entry per worksheet.
 * The library is imported on demand so it stays out of the main bundle.
 */
export async function downloadWorkbook(sheets, filename) {
  // Subpath import: the package has no root export, only ./browser, ./node, etc.
  const { default: writeXlsxFile, getSheetData } = await import('write-excel-file/browser');

  const workbook = sheets.map(({ name, rows, fields }) => {
    const columns = toColumnDefs(fields);
    return {
      sheet:   name,   // the tab label — the option is `sheet`, not `name`
      data:    getSheetData(rows, columns),
      columns: columns.map(c => ({ width: c.width })),
    };
  });

  // v4 returns a builder — `.toBlob()` / `.toFile()`, not a promise. We take the
  // blob and save it ourselves so downloads go through one code path.
  const blob = await writeXlsxFile(workbook).toBlob();
  downloadBlob(blob, filename);
}
