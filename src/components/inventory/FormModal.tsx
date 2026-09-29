import React, { useState, type ReactNode } from 'react';
import { Info, Plus } from 'lucide-react';
import { ErrorNote, ModalShell } from './ui';

export interface FormContext {
  mode: 'add' | 'edit';
  username: string;
  role: string;
  onClose: () => void;
}

/** Modal with the shared form chrome: title, inline error, audit notice, Cancel/Save. */
export function FormModal({
  ctx,
  noun,
  onSubmit,
  children,
}: {
  ctx: FormContext;
  noun: string;
  onSubmit: () => Promise<void>;
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit();
      ctx.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      wide
      onClose={ctx.onClose}
      title={<><Plus className="h-4 w-4 text-yellow-600" />{ctx.mode === 'add' ? 'Add new' : 'Edit'} {noun}</>}
    >
      <form onSubmit={submit} className="space-y-3">
        {children}
        <ErrorNote message={error} />
        <div className="bg-slate-50 p-3 rounded-lg flex items-start gap-2.5 border border-slate-100 text-[10px] text-slate-500 leading-normal">
          <Info className="h-4 w-4 text-slate-400 shrink-0" />
          <p>
            Saving records this change in the history under your account (
            <span className="font-mono font-bold text-slate-700">{ctx.username}</span>, <span className="font-bold text-amber-600">{ctx.role}</span>).
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-150">
          <button type="button" onClick={ctx.onClose} className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 font-bold px-3 py-1.5 rounded text-xs transition-colors font-mono uppercase">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold px-4 py-1.5 rounded text-xs transition-colors font-mono uppercase">
            {saving ? 'Saving…' : ctx.mode === 'add' ? 'Save entry' : 'Apply changes'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/** Draft state for a form whose fields are all strings. */
export function useDraft<T extends Record<string, string>>(initial: T) {
  const [draft, setDraft] = useState(initial);
  const bind = (key: keyof T) => ({
    value: draft[key],
    onChange: (value: string) => setDraft(d => ({ ...d, [key]: value })),
  });
  return { draft, setDraft, bind };
}
