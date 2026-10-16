/**
 * Label sheet geometry, in millimetres. Positions are absolute so the sheet does not depend on how a
 * particular printer flows content, and A4 is fixed because that is what URC prints on.
 *
 * The stock URC IT actually uses is still to be confirmed (PROJECT.md Q12), so the layout is a preset
 * plus free width and height rather than one hard-coded size.
 */

export interface LabelLayout {
  id: string;
  label: string;
  /** One label, in millimetres. */
  width: number;
  height: number;
  /** Distance from the sheet edge to the first label. */
  marginTop: number;
  marginLeft: number;
  /** Gap between labels. */
  gapX: number;
  gapY: number;
}

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/**
 * Common A4 sticker layouts. The default is the 24-per-sheet size: a code plus the asset id and name fit
 * on it without crowding, which the smaller 65-per-sheet stock cannot manage.
 */
export const LABEL_LAYOUTS: LabelLayout[] = [
  { id: '24', label: '24 per sheet — 64 × 33.9 mm', width: 64, height: 33.9, marginTop: 12.9, marginLeft: 7.2, gapX: 2.5, gapY: 0 },
  { id: '40', label: '40 per sheet — 45.7 × 25.4 mm', width: 45.7, height: 25.4, marginTop: 21.5, marginLeft: 9.8, gapX: 2.5, gapY: 0 },
  { id: '65', label: '65 per sheet — 38.1 × 21.2 mm', width: 38.1, height: 21.2, marginTop: 10.7, marginLeft: 4.7, gapX: 2.5, gapY: 0 },
];

export const DEFAULT_LAYOUT = LABEL_LAYOUTS[0];

/** How many labels fit across and down a sheet with this layout. At least one of each, so a custom size cannot divide by zero. */
export function sheetGrid(layout: LabelLayout): { columns: number; rows: number; perSheet: number } {
  const across = layout.width + layout.gapX;
  const down = layout.height + layout.gapY;
  const columns = Math.max(1, Math.floor((A4_WIDTH_MM - layout.marginLeft + layout.gapX) / across));
  const rows = Math.max(1, Math.floor((A4_HEIGHT_MM - layout.marginTop + layout.gapY) / down));
  return { columns, rows, perSheet: columns * rows };
}

/** Top-left corner of the nth label on its sheet, in millimetres. */
export function labelPosition(layout: LabelLayout, indexOnSheet: number, columns: number) {
  const row = Math.floor(indexOnSheet / columns);
  const column = indexOnSheet % columns;
  return {
    left: layout.marginLeft + column * (layout.width + layout.gapX),
    top: layout.marginTop + row * (layout.height + layout.gapY),
  };
}

/** Splits assets into sheet-sized pages, so each page can be its own print page. */
export function paginate<T>(items: T[], perSheet: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perSheet) pages.push(items.slice(i, i + perSheet));
  return pages;
}
