import { describe, expect, it } from 'vitest';
import type { HardwareAsset } from '../src/types';
import { csvCell, EMPTY_FILTERS, filterHardware, nextId, toCsv } from '../src/components/inventory/model';
import { hardwareColumns } from '../src/components/inventory/columns';
import { changedFields } from '../src/components/inventory/HistoryDialog';

const asset = (id: string, extra: Partial<HardwareAsset> = {}): HardwareAsset => ({
  id, assetName: `Asset ${id}`, departmentId: null, department: '', locationId: null, location: '', assigneeId: null, assignee: '', model: '', serialNumber: '', engravedNumber: '',
  operatingSystem: '', ram: '', hardDisk: '', lifecycleState: 'Deployed', condition: '', category: 'Laptop',
  purchaseDate: '', purchaseCost: null, orderNumber: '', supplier: '', warrantyExpires: '', warrantyNotes: '', ...extra,
});

/** The value a register/CSV column holds for one asset, by column header. */
const cells = (group: Parameters<typeof hardwareColumns>[0], h: HardwareAsset, warningDays?: number) =>
  Object.fromEntries(hardwareColumns(group, warningDays).map(c => [c.header, c.value(h)]));

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

  it('filters hardware by lifecycle state, searches the condition, and exports both in every register', () => {
    const list = [asset('HW-1'), asset('HW-2', { lifecycleState: 'In Repair', condition: 'Cracked screen' })];
    expect(filterHardware(list, { ...EMPTY_FILTERS, status: 'In Repair' }, 'All').map(h => h.id)).toEqual(['HW-2']);
    expect(filterHardware(list, { ...EMPTY_FILTERS, search: 'cracked' }, 'All').map(h => h.id)).toEqual(['HW-2']);
    for (const group of ['All', 'Network', 'Server', 'Printer'] as const) {
      const cols = hardwareColumns(group);
      const values = Object.fromEntries(cols.map(c => [c.header, c.value(list[1])]));
      expect(values).toMatchObject({ State: 'In Repair', Condition: 'Cracked screen' });
    }
  });

  it('exports the purchase block in every register, and leaves unknown values empty', () => {
    const unknown = asset('HW-5');
    const known = asset('HW-6', {
      purchaseDate: '2019-03-14', purchaseCost: 4_500_000, orderNumber: 'URC/LPO/2019/045',
      supplier: 'Kampala Computer Centre', warrantyExpires: '2030-03-14',
    });
    for (const group of ['All', 'Laptop', 'Network', 'Server', 'Printer'] as const) {
      // An asset nobody has priced exports blanks, never a 0 cost or a made-up date.
      expect(cells(group, unknown)).toMatchObject({
        Purchased: '', Warranty: '', 'Purchase Cost (UGX)': '', 'LPO / Order Ref.': '', Supplier: '',
      });
      expect(cells(group, known)).toMatchObject({
        Purchased: '2019-03-14', Warranty: '2030-03-14', 'Purchase Cost (UGX)': '4500000',
        'LPO / Order Ref.': 'URC/LPO/2019/045', Supplier: 'Kampala Computer Centre',
      });
    }
    // A legacy asset knows only the year, and that is exactly what is exported.
    expect(cells('All', asset('HW-7', { purchaseDate: '2019' })).Purchased).toBe('2019');
    // The old Year column is gone, replaced by Purchased.
    expect(hardwareColumns('All').map(c => c.header)).not.toContain('Year');
  });

  it('searches the purchase year, LPO reference and supplier', () => {
    const list = [
      asset('HW-1', { purchaseDate: '2019', orderNumber: 'URC/LPO/2019/045' }),
      asset('HW-2', { supplier: 'Nalukolongo Suppliers Ltd' }),
    ];
    expect(filterHardware(list, { ...EMPTY_FILTERS, search: 'LPO/2019' }, 'All').map(h => h.id)).toEqual(['HW-1']);
    expect(filterHardware(list, { ...EMPTY_FILTERS, search: 'nalukolongo' }, 'All').map(h => h.id)).toEqual(['HW-2']);
  });

  it('lists only the fields an edit changed, ignoring timestamps', () => {
    const before = { assetName: 'A', condition: 'OK', location: '', updatedAt: '1' };
    const after = { assetName: 'A', condition: 'Faulty', location: 'Store', updatedAt: '2' };
    expect(changedFields(before, after)).toEqual([
      { field: 'condition', from: 'OK', to: 'Faulty' },
      { field: 'location', from: '—', to: 'Store' },
    ]);
    expect(changedFields(null, after)).toEqual([]);
  });
});
