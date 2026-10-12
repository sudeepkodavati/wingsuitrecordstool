import { describe, expect, it } from 'vitest';
import { isSequentialType, recordTitle } from './records';

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
