import type { JudgeRole, RecordEntry, RecordEvent, Skydiver } from '../types';

/**
 * What participants see through a share link. Mirrors get_shared_event() in
 * supabase/migrations/20261013090000_share_links.sql: names and roles only, with no USPA IDs,
 * licenses, membership dates, phone numbers, emails or notes.
 */
export interface SharedEvent {
  event: {
    name: string;
    dropZone: string;
    city: string;
    state: string;
    startDate: string;
    endDate: string;
    organizerName: string;
    localJudge: { name: string; role: JudgeRole | '' };
    remoteJudges: { name: string; role: JudgeRole | '' }[];
  };
  skydivers: { id: string; jumperNumber: number; firstName: string; lastName: string; isVideographer: boolean }[];
  records: {
    id: string;
    zone: RecordEntry['zone'];
    state: string;
    type: RecordEntry['type'];
    attemptDate: string | null;
    viewpoint: RecordEntry['viewpoint'];
    skydiverIds: string[];
    grids: RecordEntry['grids'];
  }[];
}

export function shareUrl(token: string, origin = window.location.origin): string {
  return `${origin}/share/${token}`;
}

/** The participant subset of a full event (used by the in-memory store). */
export function toSharedEvent(e: RecordEvent): SharedEvent {
  return {
    event: {
      name: e.name,
      dropZone: e.dropZone,
      city: e.city,
      state: e.state,
      startDate: e.startDate,
      endDate: e.endDate,
      organizerName: e.organizer.name,
      localJudge: { name: e.localJudge.name, role: e.localJudge.role ?? '' },
      remoteJudges: e.remoteJudges.map((j) => ({ name: j.name, role: j.role ?? '' })),
    },
    skydivers: [...e.skydivers]
      .sort((a, b) => a.jumperNumber - b.jumperNumber)
      .map((s) => ({ id: s.id, jumperNumber: s.jumperNumber, firstName: s.firstName, lastName: s.lastName, isVideographer: s.isVideographer })),
    records: e.records.map((r) => ({
      id: r.id,
      zone: r.zone,
      state: r.state,
      type: r.type,
      attemptDate: r.attemptDate || null,
      viewpoint: r.viewpoint,
      skydiverIds: r.skydiverIds,
      grids: r.grids,
    })),
  };
}

/**
 * Rebuilds just enough of a RecordEvent for the read-only record and grid components. Fields that
 * participants never receive are left blank; callers must not show membership status.
 */
export function toViewEvent(shared: SharedEvent): RecordEvent {
  const e = shared.event;
  const skydivers: Skydiver[] = shared.skydivers.map((s) => ({
    ...s,
    nickName: '',
    uspaMembershipId: '',
    membershipExpiration: '',
    uspaLicenseNumber: '',
    addedAt: '',
  }));
  return {
    id: 'shared',
    createdBy: '',
    createdAt: '',
    updatedAt: '',
    nextJumperNumber: 0,
    name: e.name,
    dropZone: e.dropZone,
    city: e.city,
    state: e.state,
    startDate: e.startDate,
    endDate: e.endDate,
    aircraft: '',
    notes: '',
    organizer: { name: e.organizerName, phone: '', email: '' },
    localJudge: { name: e.localJudge.name, phone: '', email: '', role: e.localJudge.role },
    remoteJudges: e.remoteJudges.map((j) => ({ name: j.name, phone: '', email: '', role: j.role })),
    skydivers,
    records: shared.records.map((r) => ({ ...r, attemptDate: r.attemptDate ?? '', createdAt: '', updatedAt: '' })),
  };
}
