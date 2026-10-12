export interface Contact {
  name: string;
  phone: string;
  email: string;
}

export type JudgeRole = 'regional' | 'national' | 'dz-sta' | 'fai';

export interface Judge extends Contact {
  /** Empty until chosen in the form. */
  role: JudgeRole | '';
}

/** Fields the organizer fills in on the event form. */
export interface EventDetails {
  name: string;
  dropZone: string;
  city: string;
  state: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  aircraft: string;
  organizer: Contact;
  localJudge: Judge; // Local Judge or S&TA
  remoteJudges: Judge[];
  notes: string;
}

export interface SkydiverInput {
  firstName: string;
  lastName: string;
  nickName: string;
  uspaMembershipId: string;
  membershipExpiration: string; // YYYY-MM-DD
  uspaLicenseNumber: string;
  /** Camera flyer — can be on a record but is not placed on the formation grid. */
  isVideographer: boolean;
}

export interface Skydiver extends SkydiverInput {
  id: string;
  /** Sequential per event, never reused once assigned. */
  jumperNumber: number;
  addedAt: string;
}

export type RecordZone = 'national' | 'state' | 'uspa-open-national';

export type RecordType =
  | 'ws-lf-nogrip-horizontal'
  | 'ws-lf-nogrip-vertical'
  | 'ws-seq-lf-nogrip-horizontal'
  | 'ws-seq-lf-nogrip-vertical'
  | 'ws-lf-grip';

export interface GridPosition {
  row: number; // 0-based
  col: number; // 0-based
}

/** Formation layout: a square size × size grid with one skydiver per occupied cell. */
export interface FormationGrid {
  size: number;
  /** Keyed by skydiver id. */
  positions: Record<string, GridPosition>;
}

/** Where the formation grid is viewed from. */
export type Viewpoint = 'top-down' | 'back-to-front';

/** Fields the organizer fills in on the record form. */
export interface RecordInput {
  zone: RecordZone | '';
  /** US state code — only set when zone is "state". */
  state: string;
  type: RecordType | '';
  /** Skydiver ids from the event pool. */
  skydiverIds: string[];
  /** Formation points in order. Only sequential record types may have more than one. */
  grids: FormationGrid[];
  viewpoint: Viewpoint;
  /** YYYY-MM-DD, within the event's dates. Empty on records saved before this field existed. */
  attemptDate: string;
}

/** A record category being attempted at an event. Named RecordEntry to avoid clashing with RecordEvent. */
export interface RecordEntry extends RecordInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecordEvent extends EventDetails {
  id: string;
  /** OrganizerProfile.id of the creator — only they may modify the event. */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  nextJumperNumber: number;
  skydivers: Skydiver[];
  records: RecordEntry[];
}

export type FieldErrors = Record<string, string>;

export type OpResult = { ok: true; events: RecordEvent[]; id?: string } | { ok: false; errors: FieldErrors };
