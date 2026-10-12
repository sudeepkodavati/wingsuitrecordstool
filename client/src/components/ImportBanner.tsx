import { useState } from 'react';
import { loadLegacyEvents, markLegacyEventsImported } from '../lib/storage';
import { useEvents } from '../state/EventsContext';

/**
 * One-time import of events saved in this browser before sign-in existed. Shown only while such
 * data is present; after a successful import the old data is kept as a backup and the banner goes.
 */
export function ImportBanner() {
  const { importEvents } = useEvents();
  const [legacy, setLegacy] = useState(loadLegacyEvents);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (legacy.length === 0) {
    return message ? (
      <p role="status" className="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>
    ) : null;
  }

  const skydivers = legacy.reduce((n, e) => n + e.skydivers.length, 0);
  const records = legacy.reduce((n, e) => n + e.records.length, 0);

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const { imported, skipped } = await importEvents(legacy);
      markLegacyEventsImported();
      setLegacy([]);
      setMessage(
        `Imported ${imported} event${imported === 1 ? '' : 's'} into your account` +
          (skipped ? ` (${skipped} already imported)` : '') +
          '.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed. Nothing was removed from this browser.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50 p-4">
      <p className="font-medium text-sky-900">Events saved in this browser</p>
      <p className="mt-1 text-sm text-sky-900/80">
        This browser has {legacy.length} event{legacy.length === 1 ? '' : 's'} ({skydivers} skydivers, {records} records) saved
        before sign-in was added. Import them into your account so they're stored online. Jumper numbers, record skydivers and
        formation points are kept.
      </p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <button type="button" className="btn-primary mt-3" onClick={run} disabled={busy}>
        {busy ? 'Importing…' : `Import ${legacy.length} event${legacy.length === 1 ? '' : 's'}`}
      </button>
    </div>
  );
}
