import { describe, expect, it } from 'vitest';
import { recordTitle } from './records';

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
