import { toCsv } from '../../shared/csv';
import type { Column } from '../components/inventory/ui';

/** Builds a CSV from column definitions and triggers a browser download, used by every CSV export button. */
export function downloadCsv<T>(fileName: string, columns: Column<T>[], rows: T[]) {
  // The BOM makes Excel read the file as UTF-8.
  const blob = new Blob(['﻿' + toCsv(columns.map(c => c.header), rows.map(r => columns.map(c => c.value(r))))], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
