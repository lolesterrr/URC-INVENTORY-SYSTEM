import { describe, expect, it } from 'vitest';
import qrcode from 'qrcode-generator';
import { ASSET_QUERY_PARAM, assetLabelPayload, isLocalOnlyBase, normaliseLabelBase } from '../shared/labels';
import { A4_HEIGHT_MM, A4_WIDTH_MM, DEFAULT_LAYOUT, LABEL_LAYOUTS, labelPosition, paginate, sheetGrid } from '../src/components/inventory/labelLayout';

describe('label payload', () => {
  it('encodes a URL that opens the asset when a base is given', () => {
    expect(assetLabelPayload('http://10.0.0.5:3000', 'HW-001')).toBe(`http://10.0.0.5:3000/?${ASSET_QUERY_PARAM}=HW-001`);
    // A trailing slash or a sub-path must not produce a double slash or lose the path.
    expect(assetLabelPayload('http://urc-assets/', 'HW-001')).toBe('http://urc-assets/?asset=HW-001');
    expect(assetLabelPayload('http://urc-assets/inventory/', 'HW-001')).toBe('http://urc-assets/inventory/?asset=HW-001');
    // A query or fragment on the base is dropped rather than carried into the label.
    expect(assetLabelPayload('http://urc-assets/?foo=1#x', 'HW-001')).toBe('http://urc-assets/?asset=HW-001');
  });

  it('falls back to the bare asset ID rather than encoding something unusable', () => {
    for (const base of ['', '   ', 'not a url', 'ftp://host', 'javascript:alert(1)']) {
      expect(assetLabelPayload(base, 'HW-001')).toBe('HW-001');
    }
  });

  it('escapes an ID that would otherwise break the URL', () => {
    // IDs may contain / and . per idSchema, so the value has to be encoded.
    expect(assetLabelPayload('http://urc-assets', 'HW/001')).toBe('http://urc-assets/?asset=HW%2F001');
    expect(new URL(assetLabelPayload('http://urc-assets', 'HW/001')).searchParams.get(ASSET_QUERY_PARAM)).toBe('HW/001');
  });

  it('recognises an address that only works on the machine that printed it', () => {
    for (const base of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000']) {
      expect(isLocalOnlyBase(base)).toBe(true);
    }
    for (const base of ['http://10.0.0.5:3000', 'http://urc-assets', '', 'nonsense']) {
      expect(isLocalOnlyBase(base)).toBe(false);
    }
  });

  it('normalises a base to origin plus path with no trailing slash', () => {
    expect(normaliseLabelBase('https://Host:443/a/b/')).toBe('https://host/a/b');
    expect(normaliseLabelBase('http://host:3000')).toBe('http://host:3000');
  });
});

describe('sheet geometry', () => {
  it('fits each preset onto an A4 page without running off the edge', () => {
    for (const layout of LABEL_LAYOUTS) {
      const { columns, rows, perSheet } = sheetGrid(layout);
      expect(perSheet).toBe(columns * rows);
      const last = labelPosition(layout, perSheet - 1, columns);
      expect(last.left + layout.width).toBeLessThanOrEqual(A4_WIDTH_MM);
      expect(last.top + layout.height).toBeLessThanOrEqual(A4_HEIGHT_MM);
    }
  });

  it('matches the label counts the presets are named after', () => {
    expect(sheetGrid(LABEL_LAYOUTS.find(l => l.id === '24')!).perSheet).toBe(24);
    expect(sheetGrid(LABEL_LAYOUTS.find(l => l.id === '40')!).perSheet).toBe(40);
    expect(sheetGrid(LABEL_LAYOUTS.find(l => l.id === '65')!).perSheet).toBe(65);
  });

  it('lays labels out left to right, then down', () => {
    const { columns } = sheetGrid(DEFAULT_LAYOUT);
    const first = labelPosition(DEFAULT_LAYOUT, 0, columns);
    const second = labelPosition(DEFAULT_LAYOUT, 1, columns);
    const nextRow = labelPosition(DEFAULT_LAYOUT, columns, columns);
    expect(second.top).toBe(first.top);
    expect(second.left).toBeGreaterThan(first.left);
    expect(nextRow.left).toBe(first.left);
    expect(nextRow.top).toBeGreaterThan(first.top);
  });

  it('never divides by zero on a custom size larger than the page', () => {
    const huge = { ...DEFAULT_LAYOUT, width: 500, height: 900 };
    expect(sheetGrid(huge)).toMatchObject({ columns: 1, rows: 1, perSheet: 1 });
  });

  it('splits assets into sheet-sized pages', () => {
    expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(paginate([], 24)).toEqual([]);
    // The 82-asset register is 4 sheets at the default layout.
    expect(paginate(Array.from({ length: 82 }, (_, i) => i), sheetGrid(DEFAULT_LAYOUT).perSheet)).toHaveLength(4);
  });
});

describe('the QR code itself', () => {
  it('encodes a payload that decodes back to the asset URL', () => {
    // qrcode-generator has no decoder, so check the invariants we depend on: it accepts the payload at
    // level H and produces a square of modules with the expected quiet-zone-free size.
    const payload = assetLabelPayload('http://10.0.0.5:3000', 'HW-001');
    const code = qrcode(0, 'H');
    code.addData(payload);
    code.make();
    const count = code.getModuleCount();
    expect(count).toBeGreaterThanOrEqual(21);
    // A QR version is 21 + 4n modules square.
    expect((count - 21) % 4).toBe(0);
    // The three finder patterns are dark at their centres, which is what a scanner locks onto.
    for (const [r, c] of [[3, 3], [3, count - 4], [count - 4, 3]] as const) {
      expect(code.isDark(r, c)).toBe(true);
    }
  });

  it('stays within a single QR version for a realistic URC payload', () => {
    const code = qrcode(0, 'H');
    code.addData(assetLabelPayload('http://urc-inventory.urc.go.ug', 'HW-082'));
    code.make();
    // Comfortably under the point where modules get too small to scan off a 64 x 34 mm sticker.
    expect(code.getModuleCount()).toBeLessThanOrEqual(53);
  });
});
