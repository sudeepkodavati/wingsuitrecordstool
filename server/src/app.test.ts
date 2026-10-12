import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app';

const app = createApp();

const validEvent = {
  id: 'ignored-by-server',
  name: 'Perris Vertical Record 2026',
  dropZone: 'Skydive Perris',
  city: 'Perris',
  state: 'CA',
  startDate: '2026-10-10',
  endDate: '2026-10-12',
  aircraft: 'Twin Otter ×3',
  organizer: { name: 'Pat Organizer', phone: '555-0100', email: 'pat@example.com' },
  localJudge: { name: 'Sam S&TA', phone: '', email: '', role: 'dz-sta' },
  remoteJudges: [{ name: 'Remy Remote', phone: '', email: 'remy@example.com', role: 'fai' }],
  notes: 'Briefing at 07:30.',
  skydivers: [
    { jumperNumber: 2, firstName: 'Zoe', lastName: 'Zephyr', nickName: '', uspaMembershipId: '222', membershipExpiration: '2026-10-01', uspaLicenseNumber: 'D-2' },
    { jumperNumber: 1, firstName: 'Alex', lastName: 'Aero', nickName: 'Ace', uspaMembershipId: '111', membershipExpiration: '2027-01-01', uspaLicenseNumber: 'D-1' },
  ],
};

async function pdfRequest(body: unknown) {
  return request(app)
    .post('/api/events/pdf')
    .send(body as object)
    .buffer(true)
    .parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
}

describe('POST /api/events/pdf', () => {
  it('returns a PDF attachment for a valid event', async () => {
    const res = await pdfRequest(validEvent);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('attachment; filename="perris-vertical-record-2026-roster.pdf"');
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('renders an event with no skydivers', async () => {
    const res = await pdfRequest({ ...validEvent, skydivers: [] });
    expect(res.status).toBe(200);
  });

  it('paginates a large roster', async () => {
    const skydivers = Array.from({ length: 150 }, (_, i) => ({
      jumperNumber: i + 1,
      firstName: 'Flyer',
      lastName: String(i).padStart(3, '0'),
      nickName: '',
      uspaMembershipId: String(1000 + i),
      membershipExpiration: '2027-01-01',
      uspaLicenseNumber: `C-${i}`,
    }));
    const res = await pdfRequest({ ...validEvent, skydivers });
    expect(res.status).toBe(200);
    const pageCount = ((res.body as Buffer).toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
    expect(pageCount).toBeGreaterThan(1);
  });

  it('accepts judges saved before roles existed', async () => {
    const res = await pdfRequest({
      ...validEvent,
      localJudge: { name: 'Old Judge', phone: '', email: '' },
      remoteJudges: [{ name: 'Old Remote', phone: '', email: '' }],
    });
    expect(res.status).toBe(200);
  });

  it('rejects an unknown judge role', async () => {
    const res = await request(app)
      .post('/api/events/pdf')
      .send({ ...validEvent, localJudge: { ...validEvent.localJudge, role: 'chief' } });
    expect(res.status).toBe(400);
  });

  it('accepts videographers and skydivers saved without the flag', async () => {
    const res = await pdfRequest({
      ...validEvent,
      skydivers: [{ ...validEvent.skydivers[0], isVideographer: true }, validEvent.skydivers[1]],
    });
    expect(res.status).toBe(200);
  });

  it('accepts skydivers without a license number', async () => {
    const res = await pdfRequest({ ...validEvent, skydivers: [{ ...validEvent.skydivers[0], uspaLicenseNumber: '' }] });
    expect(res.status).toBe(200);
  });

  it('rejects an event without a name', async () => {
    const res = await request(app).post('/api/events/pdf').send({ ...validEvent, name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid event data');
  });

  it('rejects a malformed skydiver date', async () => {
    const bad = { ...validEvent, skydivers: [{ ...validEvent.skydivers[0], membershipExpiration: '10/01/2026' }] };
    const res = await request(app).post('/api/events/pdf').send(bad);
    expect(res.status).toBe(400);
  });

  it('rejects a skydiver without a last name', async () => {
    const bad = { ...validEvent, skydivers: [{ ...validEvent.skydivers[0], lastName: '' }] };
    const res = await request(app).post('/api/events/pdf').send(bad);
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON', async () => {
    const res = await request(app).post('/api/events/pdf').set('Content-Type', 'application/json').send('{not json');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Malformed JSON');
  });
});

describe('POST /api/records/pdf', () => {
  const event = {
    ...validEvent,
    skydivers: [
      { ...validEvent.skydivers[0], id: 's2' },
      { ...validEvent.skydivers[1], id: 's1' },
      { ...validEvent.skydivers[1], id: 'v1', jumperNumber: 3, firstName: 'Vic', lastName: 'Video', uspaMembershipId: '333', isVideographer: true },
    ],
  };
  const record = {
    title: 'California: WS - Large Formation (No-grip) Vertical',
    skydiverIds: ['s1', 's2', 'v1'],
    grids: [{ size: 10, positions: { s1: { row: 9, col: 9 }, s2: { row: 9, col: 8 } } }],
  };

  async function recordPdf(body: unknown) {
    return request(app)
      .post('/api/records/pdf')
      .send(body as object)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
  }

  it('returns a PDF named after the record title plus the N-way count (videographers excluded)', async () => {
    const res = await recordPdf({ event, record });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="california-ws-large-formation-no-grip-vertical-2-way.pdf"',
    );
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('handles an empty record and a large grid', async () => {
    const res = await recordPdf({ event, record: { ...record, skydiverIds: [], grids: [{ size: 30, positions: {} }] } });
    expect(res.status).toBe(200);
  });

  it('ignores positions outside the grid', async () => {
    const res = await recordPdf({ event, record: { ...record, grids: [{ size: 2, positions: { s1: { row: 5, col: 5 } } }] } });
    expect(res.status).toBe(200);
  });

  it('renders both viewpoints and defaults to top-down', async () => {
    for (const viewpoint of ['top-down', 'back-to-front', undefined]) {
      const res = await recordPdf({ event, record: { ...record, viewpoint } });
      expect(res.status).toBe(200);
    }
  });

  it('accepts an attempt date, or none for older records', async () => {
    expect((await recordPdf({ event, record: { ...record, attemptDate: '2026-10-11' } })).status).toBe(200);
    expect((await recordPdf({ event, record: { ...record, attemptDate: '' } })).status).toBe(200);
  });

  it('rejects a malformed attempt date', async () => {
    const res = await request(app).post('/api/records/pdf').send({ event, record: { ...record, attemptDate: '10/11/2026' } });
    expect(res.status).toBe(400);
  });

  it('renders a names grid with very long names and a 30 × 30 grid', async () => {
    const long = { ...event, skydivers: event.skydivers.map((s) => ({ ...s, firstName: 'Maximilian-Alexander', lastName: 'Vanderbilt-Featherstonehaugh' })) };
    const res = await recordPdf({ event: long, record: { ...record, grids: [{ size: 30, positions: { s1: { row: 29, col: 29 }, s2: { row: 0, col: 0 } } }] } });
    expect(res.status).toBe(200);
  });

  it('rejects an unknown viewpoint', async () => {
    const res = await request(app).post('/api/records/pdf').send({ event, record: { ...record, viewpoint: 'side' } });
    expect(res.status).toBe(400);
  });

  it('renders judges with and without roles, and no judges at all', async () => {
    const judged = {
      ...event,
      localJudge: { name: 'Sam Safety', phone: '', email: '', role: 'dz-sta' },
      remoteJudges: [
        { name: 'Remy Remote', phone: '', email: '', role: 'national' },
        { name: 'No Role', phone: '', email: '', role: '' },
      ],
    };
    expect((await recordPdf({ event: judged, record })).status).toBe(200);
    expect((await recordPdf({ event: { ...event, localJudge: undefined, remoteJudges: [] }, record })).status).toBe(200);
  });

  it('appends the point count for sequential records only', async () => {
    const seq = {
      ...record,
      type: 'ws-seq-lf-nogrip-vertical',
      grids: [record.grids[0], record.grids[0], record.grids[0]],
    };
    const res = await recordPdf({ event, record: seq });
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="california-ws-large-formation-no-grip-vertical-2-way-3-points.pdf"',
    );
    const one = await recordPdf({ event, record: { ...seq, grids: [record.grids[0]] } });
    expect(one.headers['content-disposition']).toMatch(/-2-way-1-point\.pdf"$/);
    const nonSeq = await recordPdf({ event, record: { ...record, type: 'ws-lf-grip' } });
    expect(nonSeq.headers['content-disposition']).toMatch(/-2-way\.pdf"$/);
  });

  it('rejects a record with no grids', async () => {
    const res = await request(app).post('/api/records/pdf').send({ event, record: { ...record, grids: [] } });
    expect(res.status).toBe(400);
  });

  it('rejects a record without a title', async () => {
    const res = await request(app).post('/api/records/pdf').send({ event, record: { ...record, title: '' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid record data');
  });

  it('rejects negative grid positions', async () => {
    const bad = { ...record, grids: [{ size: 3, positions: { s1: { row: -1, col: 0 } } }] };
    const res = await request(app).post('/api/records/pdf').send({ event, record: bad });
    expect(res.status).toBe(400);
  });
});

describe('unknown API routes', () => {
  it('return 404 JSON', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
  });
});
