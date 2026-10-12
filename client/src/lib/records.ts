import type { RecordEntry, RecordType, RecordZone } from '../types';
import { US_STATES } from './usStates';

export const RECORD_ZONE_LABELS: Record<RecordZone, string> = {
  national: 'National',
  state: 'State',
  'uspa-open-national': 'USPA Open National',
};
export const RECORD_ZONES = Object.keys(RECORD_ZONE_LABELS) as RecordZone[];

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  'ws-lf-nogrip-horizontal': 'WS - Large Formation (No-grip) Horizontal',
  'ws-lf-nogrip-vertical': 'WS - Large Formation (No-grip) Vertical',
  'ws-seq-lf-nogrip-horizontal': 'WS - Sequential Large Formation (No-grip) Horizontal',
  'ws-seq-lf-nogrip-vertical': 'WS - Sequential Large Formation (No-grip) Vertical',
  'ws-lf-grip': 'WS - Large Formation (Grip)',
};
export const RECORD_TYPES = Object.keys(RECORD_TYPE_LABELS) as RecordType[];

export function stateName(code: string): string {
  return US_STATES.find((s) => s.code === code)?.name ?? code;
}

/** e.g. "State · California" or "USPA Open National". */
export function recordZoneText(r: Pick<RecordEntry, 'zone' | 'state'>): string {
  if (!r.zone) return '';
  return r.zone === 'state' ? `State · ${stateName(r.state)}` : RECORD_ZONE_LABELS[r.zone];
}

export function recordTypeText(type: RecordEntry['type']): string {
  return type ? RECORD_TYPE_LABELS[type] : '';
}

/** "National: WS - Large Formation (Grip)", or "California: …" for a State record. */
export function recordTitle(r: Pick<RecordEntry, 'zone' | 'state' | 'type'>): string {
  const zone = r.zone === 'state' ? stateName(r.state) : r.zone ? RECORD_ZONE_LABELS[r.zone] : '';
  return `${zone}: ${recordTypeText(r.type)}`;
}
