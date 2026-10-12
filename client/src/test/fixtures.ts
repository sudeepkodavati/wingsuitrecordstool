import type { EventDetails, RecordInput, SkydiverInput } from '../types';

export const eventDetails = (overrides: Partial<EventDetails> = {}): EventDetails => ({
  name: 'Perris Vertical Record',
  dropZone: 'Skydive Perris',
  city: 'Perris',
  state: 'CA',
  startDate: '2026-10-10',
  endDate: '2026-10-12',
  aircraft: 'Twin Otter',
  organizer: { name: 'Pat Organizer', phone: '555-0100', email: '' },
  localJudge: { name: '', phone: '', email: '', role: '' },
  remoteJudges: [],
  notes: '',
  ...overrides,
});

export const skydiverInput = (overrides: Partial<SkydiverInput> = {}): SkydiverInput => ({
  firstName: 'Alex',
  lastName: 'Aero',
  nickName: '',
  uspaMembershipId: '123456',
  membershipExpiration: '2027-01-01',
  uspaLicenseNumber: 'D-12345',
  isVideographer: false,
  ...overrides,
});

export const recordInput = (overrides: Partial<RecordInput> = {}): RecordInput => ({
  zone: 'national',
  state: '',
  type: 'ws-lf-nogrip-vertical',
  skydiverIds: [],
  grids: [{ size: 10, positions: {} }],
  viewpoint: 'top-down',
  attemptDate: '2026-10-11',
  ...overrides,
});
