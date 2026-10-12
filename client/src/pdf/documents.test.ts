import { describe, expect, it } from 'vitest';
import { eventDetails } from '../test/fixtures';
import type { FormationGrid, RecordEntry, RecordEvent, Skydiver } from '../types';
import { buildRecordPdf, buildRosterPdf } from './documents';

const sky = (id: string, n: number, first: string, last: string, extra: Partial<Skydiver> = {}): Skydiver => ({
  id,
  jumperNumber: n,
  firstName: first,
  lastName: last,
  nickName: '',
  uspaMembershipId: String(100 + n),
  membershipExpiration: '2027-01-01',
  uspaLicenseNumber: `D-${n}`,
  isVideographer: false,
  addedAt: '',
  ...extra,
});

const event: RecordEvent = {
  ...eventDetails({
    name: 'Perris Vertical Record 2026',
    localJudge: { name: 'Sam Safety', phone: '', email: '', role: 'dz-sta' },
    remoteJudges: [
      { name: 'Remy Remote', phone: '', email: 'remy@example.com', role: 'national' },
      { name: 'No Role', phone: '', email: '', role: '' },
    ],
  }),
  id: 'e1',
  createdBy: 'org',
  createdAt: '',
  updatedAt: '',
  nextJumperNumber: 4,
  skydivers: [
    sky('s1', 1, 'Alex', 'Aero'),
    sky('s2', 2, 'Zoe', 'Zephyr', { membershipExpiration: '2020-01-01', uspaLicenseNumber: '' }),
    sky('v1', 3, 'Vic', 'Video', { isVideographer: true }),
  ],
  records: [],
};

const grid: FormationGrid = { size: 10, positions: { s1: { row: 9, col: 9 }, s2: { row: 9, col: 8 } } };
const record: RecordEntry = {
  id: 'r1',
  zone: 'state',
  state: 'CA',
  type: 'ws-lf-nogrip-vertical',
  skydiverIds: ['s1', 's2', 'v1'],
  grids: [grid],
  viewpoint: 'back-to-front',
  attemptDate: '2026-10-11',
  createdAt: '',
  updatedAt: '',
};

const text = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');
const pageCount = (bytes: Uint8Array) => (text(bytes).match(/\/Type \/Page\b/g) ?? []).length;
/** The PDF Info title: an indirect object holding an escaped, UTF-16BE (BOM-prefixed) string. */
function pdfTitle(bytes: Uint8Array): string | undefined {
  const s = text(bytes);
  const ref = /\/Title (\d+) 0 R/.exec(s)?.[1];
  if (!ref) return undefined;
  const obj = s.slice(s.indexOf(`\n${ref} 0 obj\n(`) + `\n${ref} 0 obj\n(`.length);
  const raw = obj.slice(0, obj.indexOf(')\nendobj')).replace(/\\(.)/g, '$1');
  const body = Buffer.from(raw, 'latin1');
  if (body[0] !== 0xfe || body[1] !== 0xff) return raw;
  return Buffer.from(body.subarray(2)).swap16().toString('utf16le');
}

describe('buildRosterPdf', () => {
  it('renders a valid PDF titled after the event', async () => {
    const bytes = await buildRosterPdf(event);
    expect(text(bytes.subarray(0, 5))).toBe('%PDF-');
    expect(pdfTitle(bytes)).toBe('Perris Vertical Record 2026 — Skydiver Roster');
  });

  it('renders an empty pool', async () => {
    expect(pageCount(await buildRosterPdf({ ...event, skydivers: [] }))).toBe(1);
  });

  it('paginates a large roster', async () => {
    const many = Array.from({ length: 150 }, (_, i) => sky(`x${i}`, i + 1, 'Flyer', String(i).padStart(3, '0')));
    expect(pageCount(await buildRosterPdf({ ...event, skydivers: many }))).toBeGreaterThan(1);
  });

  it('handles events saved before judge roles existed', async () => {
    const old = { ...event, localJudge: { name: 'Old', phone: '', email: '' }, remoteJudges: [] } as unknown as RecordEvent;
    expect(pageCount(await buildRosterPdf(old))).toBeGreaterThan(0);
  });
});

describe('buildRecordPdf', () => {
  it('titles the PDF "Zone: Type - N way", counting participants only', async () => {
    const bytes = await buildRecordPdf(event, record);
    expect(text(bytes.subarray(0, 5))).toBe('%PDF-');
    expect(pdfTitle(bytes)).toBe('California: WS - Large Formation (No-grip) Vertical - 2 way');
    // Short tables leave room for the icon grid on page 1; the names grid gets page 2.
    expect(pageCount(bytes)).toBe(2);
  });

  it('prints every point of a sequential record and adds the point count to the title', async () => {
    const seq: RecordEntry = { ...record, type: 'ws-seq-lf-nogrip-vertical', grids: [grid, grid, grid] };
    const bytes = await buildRecordPdf(event, seq);
    expect(pdfTitle(bytes)).toBe('California: WS - Sequential Large Formation (No-grip) Vertical - 2 way - 3-points');
    expect(pageCount(bytes)).toBe(7);
    const one = await buildRecordPdf(event, { ...seq, grids: [grid] });
    expect(pdfTitle(one)).toMatch(/- 2 way - 1-point$/);
  });

  it('prints only the first point for non-sequential records', async () => {
    expect(pageCount(await buildRecordPdf(event, { ...record, grids: [grid, grid] }))).toBe(2);
  });

  it('handles an empty record, a 30 × 30 grid and positions outside the grid', async () => {
    expect(pageCount(await buildRecordPdf(event, { ...record, skydiverIds: [], grids: [{ size: 30, positions: {} }] }))).toBe(2);
    const outside = { ...record, grids: [{ size: 2, positions: { s1: { row: 5, col: 5 } } }] };
    expect(pageCount(await buildRecordPdf(event, outside))).toBe(2);
  });

  it('fits very long names into small cells', async () => {
    const long = {
      ...event,
      skydivers: event.skydivers.map((s) => ({ ...s, firstName: 'Maximilian-Alexander', lastName: 'Vanderbilt-Featherstonehaugh' })),
    };
    const big = { ...record, grids: [{ size: 30, positions: { s1: { row: 29, col: 29 }, s2: { row: 0, col: 0 } } }] };
    expect(pageCount(await buildRecordPdf(long, big))).toBeGreaterThanOrEqual(2);
  });

  it('renders both viewpoints and events with no judges', async () => {
    const noJudges = { ...event, localJudge: { name: '', phone: '', email: '', role: '' as const }, remoteJudges: [] };
    for (const viewpoint of ['top-down', 'back-to-front'] as const) {
      expect(pageCount(await buildRecordPdf(noJudges, { ...record, viewpoint }))).toBe(2);
    }
  });
});
