import type { RecordEntry, RecordEvent } from '../types';
import { recordTitle } from './records';
import { formationIds, normalizeGrids } from './validation';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event';
}

async function downloadPdf(url: string, body: unknown, filename: string): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `PDF export failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // non-JSON error body
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  // Use the server's filename when given (e.g. the record PDF adds the "N way" count).
  const serverName = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1];
  a.download = serverName || filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Sends the event to the Node server, which renders the roster PDF, then triggers a download. */
export function exportEventPdf(event: RecordEvent): Promise<void> {
  return downloadPdf('/api/events/pdf', event, `${slugify(event.name)}-roster.pdf`);
}

/** Record PDF: title, the record's skydivers, and its formation grid (videographers excluded). */
export function exportRecordPdf(event: RecordEvent, record: RecordEntry): Promise<void> {
  const title = recordTitle(record);
  const grids = normalizeGrids(record.grids, record.type, formationIds(record.skydiverIds, event));
  return downloadPdf(
    '/api/records/pdf',
    {
      event,
      record: {
        title,
        type: record.type,
        skydiverIds: record.skydiverIds,
        grids,
        viewpoint: record.viewpoint,
        attemptDate: record.attemptDate,
      },
    },
    `${slugify(title)}.pdf`,
  );
}
