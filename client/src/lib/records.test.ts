import { describe, expect, it } from 'vitest';
import { isSequentialType, recordPdfTitle, recordPointCount, recordTitle } from './records';
import type { RecordEntry, RecordEvent } from '../types';

describe('recordTitle', () => {
  it('uses the zone name for National and USPA Open National records', () => {
    expect(recordTitle({ zone: 'national', state: '', type: 'ws-lf-grip' })).toBe('National: WS - Large Formation (Grip)');
    expect(recordTitle({ zone: 'uspa-open-national', state: '', type: 'ws-lf-nogrip-vertical' })).toBe(
      'USPA Open National: WS - Large Formation (No-grip) Vertical',
    );
  });

  it('uses the state name for State records', () => {
    expect(recordTitle({ zone: 'state', state: 'CA', type: 'ws-seq-lf-nogrip-horizontal' })).toBe(
      'California: WS - Sequential Large Formation (No-grip) Horizontal',
    );
  });
});

describe('isSequentialType', () => {
  it('is true only for the two sequential types', () => {
    expect(isSequentialType('ws-seq-lf-nogrip-horizontal')).toBe(true);
    expect(isSequentialType('ws-seq-lf-nogrip-vertical')).toBe(true);
    expect(isSequentialType('ws-lf-nogrip-vertical')).toBe(false);
    expect(isSequentialType('ws-lf-grip')).toBe(false);
    expect(isSequentialType('')).toBe(false);
  });
});

describe('recordPdfTitle', () => {
  const s = (id: string, isVideographer = false) => ({ id, isVideographer }) as RecordEvent['skydivers'][number];
  const event = { skydivers: [s('a'), s('b'), s('v', true), s('other')] };
  const record = { zone: 'national', state: '', type: 'ws-lf-grip', skydiverIds: ['a', 'b', 'v'], grids: [] } as unknown as RecordEntry;

  it('appends the participant count, excluding videographers', () => {
    expect(recordPdfTitle(event, record)).toBe('National: WS - Large Formation (Grip) - 2 way');
  });

  it('adds the point count for sequential records only', () => {
    const g = { size: 10, positions: {} };
    const seq = { ...record, type: 'ws-seq-lf-nogrip-horizontal', grids: [g, g, g] } as RecordEntry;
    expect(recordPdfTitle(event, seq)).toBe('National: WS - Sequential Large Formation (No-grip) Horizontal - 2 way - 3-points');
    expect(recordPdfTitle(event, { ...seq, grids: [] })).toMatch(/- 2 way - 1-point$/);
    expect(recordPointCount({ ...record, grids: [g, g] })).toBe(1);
  });
});
