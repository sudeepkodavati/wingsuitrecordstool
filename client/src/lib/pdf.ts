import type { RecordEntry, RecordEvent } from '../types';
import { recordPdfTitle } from './records';

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event';
}

// pdfkit and its fonts are large, so the PDF code is only downloaded the first time someone prints.
const loadDocuments = () => import('../pdf/documents');

function download(bytes: Uint8Array, filename: string) {
  const href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Builds the event roster PDF in the browser and downloads it. */
export async function exportEventPdf(event: RecordEvent): Promise<void> {
  const { buildRosterPdf } = await loadDocuments();
  download(await buildRosterPdf(event), `${slugify(event.name)}-roster.pdf`);
}

/** Record PDF: title, judges, participant and videographer tables, and the formation point grids. */
export async function exportRecordPdf(event: RecordEvent, record: RecordEntry): Promise<void> {
  const { buildRecordPdf } = await loadDocuments();
  download(await buildRecordPdf(event, record), `${slugify(recordPdfTitle(event, record))}.pdf`);
}
