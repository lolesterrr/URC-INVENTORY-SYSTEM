import { describe, expect, it } from 'vitest';
import type { HardwareAsset } from '../src/types';
import { csvCell, EMPTY_FILTERS, filterHardware, nextId, toCsv } from '../src/components/inventory/model';
import { hardwareColumns } from '../src/components/inventory/columns';

const asset = (id: string, extra: Partial<HardwareAsset> = {}): HardwareAsset => ({
  id, user: '', assetName: `Asset ${id}`, yearOfPurchase: '', location: '', model: '', serialNumber: '', engravedNumber: '',
  operatingSystem: '', ram: '', hardDisk: '', status: 'In Use', category: 'Laptop', ...extra,
});

describe('inventory model', () => {
  it('suggests the next ID in sequence', () => {
    expect(nextId('HW-', ['HW-001', 'HW-082', 'HW-7', 'SW-900', 'HW-X'])).toBe('HW-083');
    expect(nextId('SC-', [])).toBe('SC-001');
  });

  it('filters by device group, search text and department', () => {
    const list = [
      asset('HW-001', { category: 'Switch', ipAddress: '10.0.0.5', department: 'PROCUREMENT' }),
      asset('HW-002', { category: 'Router' }),
      asset('HW-003', { category: 'Laptop', serialNumber: 'ABC123' }),
    ];
    expect(filterHardware(list, EMPTY_FILTERS, 'Network').map(h => h.id)).toEqual(['HW-001', 'HW-002']);
    expect(filterHardware(list, { ...EMPTY_FILTERS, search: 'abc1' }, 'All').map(h => h.id)).toEqual(['HW-003']);
    expect(filterHardware(list, { ...EMPTY_FILTERS, search: '10.0.0' }, 'All').map(h => h.id)).toEqual(['HW-001']);
    expect(filterHardware(list, { ...EMPTY_FILTERS, department: 'PROCUREMENT' }, 'All').map(h => h.id)).toEqual(['HW-001']);
  });

  it('escapes quotes and neutralises spreadsheet formulas in CSV', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('-5')).toBe(`"'-5"`);
    expect(toCsv(['A', 'B'], [['1', '2']])).toBe('"A","B"\r\n"1","2"');
  });

  it('exports empty fields as empty, never as invented values', () => {
    const cols = hardwareColumns('Network');
    const row = cols.map(c => c.value(asset('HW-9', { category: 'Switch' })));
    expect(cols.map(c => c.header)).toContain('Management IP');
    expect(row[cols.findIndex(c => c.header === 'Management IP')]).toBe('');
    expect(row.join('')).not.toMatch(/10\.100|N\/A|Gigabit/);
  });
});
