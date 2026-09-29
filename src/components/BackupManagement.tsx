import { useEffect, useState } from 'react';
import { CheckCircle2, DatabaseBackup, RefreshCw, TriangleAlert } from 'lucide-react';
import { api } from '../api';
import type { BackupStatus } from '../types';

const formatSize = (bytes: number) =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export default function BackupManagement() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setStatus(await api<BackupStatus>('/api/backups'));
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not load backups.' });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const backupNow = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await api<{ name: string; copyError: string | null }>('/api/backups', { method: 'POST' });
      setMessage(
        result.copyError
          ? { kind: 'error', text: `Backup ${result.name} was created, but the second copy failed: ${result.copyError}` }
          : { kind: 'ok', text: `Backup ${result.name} created and verified.` },
      );
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Backup failed.' });
    } finally {
      setBusy(false);
      await load();
    }
  };

  const last = status?.last;
  const s = status?.settings;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Backups</h2>
          <p className="text-xs text-slate-500">
            The database is copied and checked automatically every night. To restore, stop the service and run{' '}
            <code className="font-mono">npm run restore -- &lt;file&gt;</code> on the server.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={load} className="p-2 text-slate-500 hover:text-slate-900" aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={backupNow}
            disabled={busy || status?.running}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-sm rounded-md"
          >
            <DatabaseBackup className="h-4 w-4" />
            {busy || status?.running ? 'Backing up…' : 'Backup now'}
          </button>
        </div>
      </div>

      {message && (
        <div role="status" className={`p-3 text-xs rounded-md font-semibold border ${message.kind === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {status && s && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-[10px] uppercase font-mono text-slate-500 mb-1">Last backup</p>
            {!last ? (
              <p className="text-slate-500">None since the server started.</p>
            ) : last.ok ? (
              <p className="flex items-center gap-1 font-bold text-green-700">
                <CheckCircle2 className="h-4 w-4" /> {new Date(last.finishedAt).toLocaleString()}
              </p>
            ) : (
              <p className="flex items-center gap-1 font-bold text-red-600">
                <TriangleAlert className="h-4 w-4" /> Failed: {last.error}
              </p>
            )}
            {last?.copyError && <p className="text-red-600 mt-1">Second copy failed: {last.copyError}</p>}
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-[10px] uppercase font-mono text-slate-500 mb-1">Next scheduled</p>
            <p className="font-bold text-slate-900">{new Date(status.nextRunAt).toLocaleString()}</p>
            <p className="text-slate-500 mt-1">
              Keeps {s.retention.daily} daily, {s.retention.weekly} weekly and {s.retention.monthly} monthly backups.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4 break-all">
            <p className="text-[10px] uppercase font-mono text-slate-500 mb-1">Location</p>
            <p className="font-mono text-slate-900">{s.directory}</p>
            <p className="text-slate-500 mt-1">
              Second copy: {s.copyDirectory ? <span className="font-mono text-slate-900">{s.copyDirectory}</span> : 'not configured (set BACKUP_COPY_DIR)'}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px]">
            <tr>
              <th className="text-left p-3">File</th>
              <th className="text-left p-3">Created</th>
              <th className="text-right p-3">Size</th>
              {s?.copyDirectory && <th className="text-left p-3">Second copy</th>}
            </tr>
          </thead>
          <tbody>
            {status?.backups.map(b => (
              <tr key={b.name} className="border-t border-slate-100">
                <td className="p-3 font-mono">{b.name}</td>
                <td className="p-3">{new Date(b.createdAt).toLocaleString()}</td>
                <td className="p-3 text-right">{formatSize(b.sizeBytes)}</td>
                {s?.copyDirectory && <td className="p-3">{b.copied ? 'Yes' : <span className="text-red-600 font-bold">Missing</span>}</td>}
              </tr>
            ))}
            {status && status.backups.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-500">No backups yet. Click “Backup now” to create the first one.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
