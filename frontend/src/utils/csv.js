// ── CSV generation helpers — client-side, no dependencies ─────────────────────

/** Quote a value only when it contains a comma, quote, or newline (RFC 4180). */
const escape = (v) => {
  const s = v == null ? '' : String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
};

/** Build a CSV string from row objects keyed by the given column names. */
export function toCSV(rows, columns) {
  return [
    columns.join(','),
    ...rows.map(r => columns.map(c => escape(r[c])).join(',')),
  ].join('\r\n');
}

/**
 * Trigger a browser download of `blob` as `filename`.
 * The anchor must be in the document — Chrome ignores clicks on a detached one.
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Trigger a browser download of CSV text as `filename`. */
export function downloadCSV(content, filename) {
  downloadBlob(new Blob([content], { type: 'text/csv;charset=utf-8;' }), filename);
}

/** `(passed / total * 100)` to one decimal — empty string when total is 0 or missing. */
export function passRate(passed, total) {
  return total ? ((passed || 0) / total * 100).toFixed(1) : '';
}

/** Minutes between two timestamps to one decimal — empty when either is missing or unparseable. */
export function durationMin(start, end) {
  if (!start || !end) return '';
  const ms = new Date(end) - new Date(start);
  return isNaN(ms) ? '' : (ms / 60000).toFixed(1);
}

/** Strip characters that are awkward in filenames. */
export const slug = (s) => String(s ?? '').trim().replace(/[^A-Za-z0-9._-]+/g, '_') || 'all';
