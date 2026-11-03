/** Organisation-wide settings: company name, default QR label size, and the replacement-life policy per category. Admin only. */
import { useEffect, useState } from 'react';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import { LABEL_LAYOUTS } from './inventory/labelLayout';
import { HARDWARE_CATEGORIES } from './inventory/model';
import type { useSettings } from '../hooks/useSettings';
import type { AppSettings } from '../types';

const CUSTOM = 'custom';
const input =
  'w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500';
const label = 'block text-[10px] font-bold text-slate-500 uppercase font-mono mb-1';

/**
 * Takes the single `useSettings()` instance MainApp owns, rather than loading its own — so saving here
 * is reflected immediately in the sidebar's company name and the label dialog's default size, not just
 * after the next page load.
 */
export default function SettingsView({ settings: { data, isLoading, error, refresh, save } }: { settings: ReturnType<typeof useSettings> }) {
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  if (isLoading && !draft) {
    return <div className="h-64 flex items-center justify-center text-slate-400 text-sm font-semibold">Loading settings…</div>;
  }
  if (error || !draft) {
    return (
      <div className="p-4 text-xs rounded-md font-semibold border bg-red-50 border-red-200 text-red-700 flex justify-between gap-4">
        <span>{error ?? 'Could not load settings.'}</span>
        <button onClick={refresh} className="underline shrink-0">Try again</button>
      </div>
    );
  }

  const onSave = async () => {
    setSaving(true);
    setSaveError(null);
    setStatus(null);
    try {
      await save(draft);
      setStatus('Saved.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-5 w-5 text-slate-700" />
        <h2 className="text-lg font-bold text-slate-900">Settings</h2>
      </div>

      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono border-b border-slate-150 pb-2">Organisation</h3>
        <label className="block max-w-sm">
          <span className={label}>Company name</span>
          <input value={draft.companyName} onChange={e => setDraft({ ...draft, companyName: e.target.value })} className={input} />
          <span className="block mt-1 text-[10px] text-slate-400">Shown in the sidebar.</span>
        </label>
      </div>

      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono border-b border-slate-150 pb-2">Default QR label size</h3>
        <p className="text-[11px] text-slate-500">
          What the "Print asset labels" dialog starts with. IT staff can still pick a different size when printing; this just saves re-selecting it
          every time.
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <label className="block">
            <span className={label}>Label size</span>
            <select value={draft.defaultLabelPreset} onChange={e => setDraft({ ...draft, defaultLabelPreset: e.target.value })} className={input}>
              {LABEL_LAYOUTS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              <option value={CUSTOM}>Custom size…</option>
            </select>
          </label>
          {draft.defaultLabelPreset === CUSTOM && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className={label}>Width (mm)</span>
                <input
                  type="number" min={8} step="0.1"
                  value={draft.defaultLabelWidthMm ?? ''}
                  onChange={e => setDraft({ ...draft, defaultLabelWidthMm: e.target.value === '' ? null : Number(e.target.value) })}
                  className={input}
                />
              </label>
              <label className="block">
                <span className={label}>Height (mm)</span>
                <input
                  type="number" min={8} step="0.1"
                  value={draft.defaultLabelHeightMm ?? ''}
                  onChange={e => setDraft({ ...draft, defaultLabelHeightMm: e.target.value === '' ? null : Number(e.target.value) })}
                  className={input}
                />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono border-b border-slate-150 pb-2">Replacement-life policy</h3>
        <p className="text-[11px] text-slate-500">
          Years before a hardware asset in each category is due for replacement, used by the "Due for Replacement" report. These are common industry
          defaults, not a policy URC has confirmed — set the real figures here once they are known. Leave a category blank for "no policy".
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl">
          {HARDWARE_CATEGORIES.map(category => (
            <label key={category} className="block">
              <span className={label}>{category}</span>
              <input
                type="number" min={1} max={50} step="1"
                placeholder="No policy"
                value={draft.replacementPolicy[category] ?? ''}
                onChange={e =>
                  setDraft({
                    ...draft,
                    replacementPolicy: { ...draft.replacementPolicy, [category]: e.target.value === '' ? null : Number(e.target.value) },
                  })
                }
                className={input}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded flex items-center gap-2 font-mono uppercase disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {status && <span className="text-xs text-green-700 font-semibold">{status}</span>}
        {saveError && <span className="text-xs text-red-700 font-semibold">{saveError}</span>}
      </div>
    </div>
  );
}
