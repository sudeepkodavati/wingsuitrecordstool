import { useState } from 'react';
import { shareUrl } from '../lib/share';
import { useEvents } from '../state/EventsContext';
import type { RecordEvent } from '../types';

/** Owner controls for the participant link: create, copy, replace, stop. */
export function SharePanel({ event }: { event: RecordEvent }) {
  const { setSharing } = useEvents();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const token = event.shareToken ?? null;
  const url = token ? shareUrl(token) : '';

  const change = async (enabled: boolean, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError('');
    setCopied(false);
    const result = await setSharing(event.id, enabled);
    setBusy(false);
    if (!result.ok) setError(result.errors.form ?? 'Could not change sharing.');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError('Copy failed. Select the link and copy it manually.');
    }
  };

  return (
    <section className="card p-5" aria-labelledby="share-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="share-heading" className="font-semibold text-slate-900">Participant link</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-slate-600">
            A read-only page for participants, no login needed. It shows names, jumper numbers, records and formations, but
            no USPA IDs, licenses, membership dates or contact details, and no PDFs.
          </p>
        </div>
        {token ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            Sharing on
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Not shared</span>
        )}
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

      {token ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              readOnly
              value={url}
              aria-label="Participant link"
              onFocus={(e) => e.currentTarget.select()}
              className="input flex-1 font-mono text-xs"
            />
            <button type="button" className="btn-primary" onClick={copy}>
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
            <a href={url} target="_blank" rel="noreferrer" className="btn-secondary">
              Open
            </a>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <button
              type="button"
              className="text-sky-700 hover:underline disabled:opacity-60"
              disabled={busy}
              onClick={() => change(true, 'Create a new link? The current link will stop working for everyone who has it.')}
            >
              New link
            </button>
            <button
              type="button"
              className="text-red-600 hover:underline disabled:opacity-60"
              disabled={busy}
              onClick={() => change(false, 'Stop sharing? The link will stop working for everyone who has it.')}
            >
              Stop sharing
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-secondary mt-4" disabled={busy} onClick={() => change(true)}>
          {busy ? 'Creating…' : 'Create share link'}
        </button>
      )}
    </section>
  );
}
