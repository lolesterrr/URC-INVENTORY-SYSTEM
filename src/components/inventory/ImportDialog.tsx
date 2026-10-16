/**
 * Bulk update of the hardware register from a CSV file: pick a file, read the preview the server returns,
 * then apply it. The preview and the import are the same server call, one with `dryRun`, so what is listed
 * here is what the import does.
 */
import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Info, RefreshCw, Upload } from 'lucide-react';
import type { ImportResult, ImportRow } from '../../types';
import { Badge, ErrorNote, ModalShell, type Tone } from './ui';

const STATUS_TONES: Record<ImportRow['status'], Tone> = { create: 'green', update: 'blue', unchanged: 'slate', rejected: 'red' };
const STATUS_WORDS: Record<ImportRow['status'], string> = { create: 'add', update: 'update', unchanged: 'no change', rejected: 'rejected' };

const button = 'px-4 py-2 font-bold rounded-lg text-xs uppercase font-mono flex items-center gap-2 disabled:opacity-50';

function Counts({ result }: { result: ImportResult }) {
  const tiles: { label: string; value: number; tone: string }[] = [
    { label: 'to add', value: result.created, tone: 'text-green-700' },
    { label: 'to update', value: result.updated, tone: 'text-blue-700' },
    { label: 'no change', value: result.unchanged, tone: 'text-slate-500' },
    { label: 'rejected', value: result.rejected, tone: result.rejected ? 'text-red-700' : 'text-slate-400' },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {tiles.map(t => (
        <div key={t.label} className="bg-slate-50 border border-slate-200 rounded p-2 text-center">
          <div className={`text-lg font-bold font-mono ${t.tone}`}>{t.value}</div>
          <div className="text-[9px] uppercase font-mono font-bold text-slate-500 tracking-wide">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

/** Rejected rows first: they are the ones that need the spreadsheet fixing. */
function RowList({ rows }: { rows: ImportRow[] }) {
  const ordered = [...rows].sort((a, b) => Number(b.status === 'rejected') - Number(a.status === 'rejected') || a.row - b.row);
  return (
    <div className="max-h-56 overflow-y-auto border border-slate-200 rounded">
      <table className="w-full text-[11px]">
        <tbody>
          {ordered.map(r => (
            <tr key={r.row} className="border-b border-slate-100 last:border-0 align-top">
              <td className="px-2 py-1.5 text-slate-400 font-mono whitespace-nowrap">Row {r.row}</td>
              <td className="px-2 py-1.5 font-mono font-bold text-slate-800 whitespace-nowrap">{r.id || '—'}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                <Badge tone={STATUS_TONES[r.status]}>{STATUS_WORDS[r.status]}</Badge>
              </td>
              <td className="px-2 py-1.5 text-slate-600 leading-snug">
                {r.error ?? (r.changed?.length ? r.changed.join(', ') : '')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Notices({ result }: { result: ImportResult }) {
  const missing = [...result.missingDepartments, ...result.missingLocations];
  return (
    <div className="space-y-2">
      {result.needsDirectoryConsent && (
        <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-[11px] text-amber-900 leading-snug">
          <span className="font-bold">Not in the Directory yet:</span> {missing.join(', ')}. Tick the box below to have the import add them,
          or add them on the Directory screen first.
        </div>
      )}
      {!result.needsDirectoryConsent && (result.createdDepartments.length > 0 || result.createdLocations.length > 0) && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2.5 text-[11px] text-blue-900 leading-snug">
          <span className="font-bold">{result.dryRun ? 'Would be added' : 'Added'} to the Directory:</span>{' '}
          {[...result.createdDepartments, ...result.createdLocations].join(', ')}.
        </div>
      )}
      {result.ignoredColumns.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-[11px] text-slate-600 leading-snug space-y-1">
          {result.ignoredColumns.map(c => (
            <p key={c.header}>
              <span className="font-mono font-bold text-slate-700">{c.header}</span> — {c.reason}
            </p>
          ))}
        </div>
      )}
      {result.unknownColumns.length > 0 && (
        <p className="text-[11px] text-slate-500 leading-snug">
          Columns the import does not know, left alone: <span className="font-mono">{result.unknownColumns.join(', ')}</span>.
        </p>
      )}
    </div>
  );
}

export function ImportDialog({
  onPreview,
  onImport,
  onClose,
}: {
  /** Asks the server what the file would do, without changing anything. */
  onPreview: (csv: string, createMissingDirectory: boolean) => Promise<ImportResult>;
  onImport: (csv: string, createMissingDirectory: boolean) => Promise<ImportResult>;
  onClose: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [csv, setCsv] = useState('');
  const [createMissing, setCreateMissing] = useState(false);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (text: string, allowCreate: boolean) => {
    setBusy(true);
    setError(null);
    try {
      setPreview(await onPreview(text, allowCreate));
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

  const chooseFile = async (file: File) => {
    setFileName(file.name);
    setDone(null);
    const text = await file.text();
    setCsv(text);
    await run(text, createMissing);
  };

  const toggleCreateMissing = async (next: boolean) => {
    setCreateMissing(next);
    if (csv) await run(csv, next);
  };

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      setDone(await onImport(csv, createMissing));
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The import failed.');
    } finally {
      setBusy(false);
    }
  };

  const applicable = preview ? preview.created + preview.updated : 0;

  return (
    <ModalShell wide onClose={busy ? () => undefined : onClose} title={<><Upload className="h-4 w-4 text-yellow-600" />Import hardware from CSV</>}>
      <div className="space-y-3">
        {!done && (
          <>
            <p className="text-[11px] text-slate-600 leading-snug">
              Rows are matched on <span className="font-mono font-bold">Asset ID</span>: an ID already in the register is updated, a new one is
              added. Export the register first to get a file with the right headings. A column your file leaves out is not touched; an empty cell
              in a column it does have clears that field.
            </p>
            <div>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                aria-label="CSV file"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) void chooseFile(file);
                }}
                className="hidden"
              />
              <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className={`${button} bg-white border border-slate-300 text-slate-700 hover:bg-slate-50`}>
                <FileUp className="h-3.5 w-3.5 text-slate-400" />
                {fileName ? 'Choose another file' : 'Choose a CSV file'}
              </button>
              {fileName && <span className="ml-2 text-[11px] font-mono text-slate-500">{fileName}</span>}
            </div>
          </>
        )}

        {busy && !done && (
          <p className="text-[11px] text-slate-500 flex items-center gap-2 font-mono">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Checking the file…
          </p>
        )}

        <ErrorNote message={error} />

        {preview && (
          <>
            <Counts result={preview} />
            <Notices result={preview} />
            <RowList rows={preview.rows} />
            <label className="flex items-start gap-2 text-[11px] text-slate-700 leading-snug">
              <input type="checkbox" checked={createMissing} onChange={e => void toggleCreateMissing(e.target.checked)} disabled={busy} className="mt-0.5" />
              <span>Create the departments and locations the file names but the Directory does not hold.</span>
            </label>
            <div className="bg-slate-50 p-2.5 rounded border border-slate-100 flex items-start gap-2 text-[10px] text-slate-500 leading-normal">
              <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <p>
                Nothing has been changed yet. Each asset the import touches gets an entry in its own history, and lifecycle state and assignee are
                never changed by an import — use Change state, check-out and check-in for those.
              </p>
            </div>
          </>
        )}

        {done && (
          <>
            <div className="bg-green-50 border border-green-200 rounded p-2.5 text-xs text-green-900 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p>
                <span className="font-bold">Import finished.</span> {done.created} added, {done.updated} updated, {done.unchanged} unchanged
                {done.rejected > 0 && <>, {done.rejected} rejected</>} out of {done.rowsRead} rows read.
              </p>
            </div>
            {done.rejected > 0 && (
              <>
                <p className="text-[11px] text-slate-600 flex items-start gap-2 leading-snug">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  These rows were left out. Fix them in the spreadsheet and import again — the rows that went in will show as unchanged.
                </p>
                <RowList rows={done.rows.filter(r => r.status === 'rejected')} />
              </>
            )}
            <Notices result={done} />
          </>
        )}

        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-150">
          <button type="button" onClick={onClose} disabled={busy} className={`${button} bg-slate-100 hover:bg-slate-200 text-slate-700`}>
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button type="button" onClick={apply} disabled={busy || !preview || applicable === 0} className={`${button} bg-slate-900 hover:bg-slate-800 text-white`}>
              {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {busy ? 'Importing…' : applicable > 0 ? `Import ${applicable} row${applicable === 1 ? '' : 's'}` : 'Nothing to import'}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
