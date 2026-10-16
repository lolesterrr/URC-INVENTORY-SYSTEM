/**
 * CSV rules shared by the export and the import. Dependency-free, so it is safe to bundle into the
 * browser and to use from the server at the same time. Keeping both directions here means a change to
 * the way a cell is written is also a change to the way it is read back.
 */

/** Quotes a CSV cell and neutralises values a spreadsheet would run as a formula. */
export function csvCell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: string[][]): string {
  return [headers.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\r\n');
}

const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Undoes the guard `csvCell` adds, and only in that exact case: a leading apostrophe followed by one of
 * the characters a spreadsheet would treat as a formula. So a condition note like `-- faulty` survives an
 * export and a re-import, while a value that genuinely starts with an apostrophe is left alone.
 */
export function unescapeCsvFormula(value: string): string {
  return value.startsWith("'") && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value;
}

/**
 * Parses CSV text into rows of cells (RFC 4180): double quotes around a field, `""` for a quote inside
 * one, and commas and newlines allowed inside quotes. Tolerates CRLF or LF, a UTF-8 BOM (Excel writes
 * one), and a missing final newline. Blank lines are dropped, so a trailing newline adds no empty row.
 */
export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  // True once anything has been seen on this line, so a line of only separators is kept but a blank one is not.
  let started = false;

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    // A line holding a single empty, unquoted cell is blank padding, not a record.
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
    started = false;
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === '') {
      quoted = true;
      started = true;
    } else if (ch === ',') {
      endCell();
      started = true;
    } else if (ch === '\r') {
      // Swallow CR; the LF that follows ends the row. A lone CR ends it too.
      if (input[i + 1] === '\n') i++;
      endRow();
    } else if (ch === '\n') {
      endRow();
    } else {
      cell += ch;
      started = true;
    }
  }
  if (started || cell !== '' || row.length) endRow();
  return rows;
}

/** Header text as it is matched: case and surrounding spaces are ignored, inner spacing is collapsed. */
export function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ');
}
