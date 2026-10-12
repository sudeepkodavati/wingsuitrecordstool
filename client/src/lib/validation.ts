import type { Contact, EventDetails, FieldErrors, Judge, JudgeRole, RecordEvent, RecordInput, SkydiverInput } from '../types';
import { formatDate, isValidIsoDate } from './dates';
import { reconcileGrid } from './grid';
import { displayName } from './names';
import { LOCAL_JUDGE_ROLES, REMOTE_JUDGE_ROLES } from './judges';
import { DEFAULT_VIEWPOINT, isViewpoint } from './viewpoint';
import { RECORD_TYPES, RECORD_ZONES, recordTypeText, recordZoneText } from './records';
import { US_STATES } from './usStates';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MEMBERSHIP_ID = /^\d{1,10}$/;
const LICENSE = /^[A-D]-\d{1,7}$/;

const clean = (s: string) => s.trim().replace(/\s+/g, ' ');

function cleanContact(c: Contact): Contact {
  return { name: clean(c.name), phone: clean(c.phone), email: c.email.trim() };
}

function cleanJudge(j: Judge): Judge {
  return { ...cleanContact(j), role: j.role ?? '' };
}

export function normalizeEventDetails(d: EventDetails): EventDetails {
  return {
    ...d,
    name: clean(d.name),
    dropZone: clean(d.dropZone),
    city: clean(d.city),
    state: d.state.trim(),
    aircraft: clean(d.aircraft),
    organizer: cleanContact(d.organizer),
    localJudge: cleanJudge(d.localJudge),
    remoteJudges: d.remoteJudges.map(cleanJudge).filter((j) => j.name || j.phone || j.email || j.role),
    notes: d.notes.trim(),
  };
}

function validateContact(c: Contact, prefix: string, errors: FieldErrors, required: boolean) {
  const anyFilled = Boolean(c.name || c.phone || c.email);
  if ((required || anyFilled) && !c.name) errors[`${prefix}.name`] = 'Name is required';
  if (c.email && !EMAIL.test(c.email)) errors[`${prefix}.email`] = 'Enter a valid email address';
}

function validateJudge(j: Judge, prefix: string, errors: FieldErrors, required: boolean, allowed: JudgeRole[]) {
  validateContact(j, prefix, errors, required);
  const anyFilled = Boolean(j.name || j.phone || j.email || j.role);
  if (!required && !anyFilled) return;
  if (!j.role) errors[`${prefix}.role`] = 'Select a role';
  else if (!allowed.includes(j.role)) errors[`${prefix}.role`] = 'Select a valid role';
  if (!j.name) errors[`${prefix}.name`] = 'Name is required';
}

/** Expects normalized input. */
export function validateEventDetails(d: EventDetails): FieldErrors {
  const errors: FieldErrors = {};
  if (!d.name) errors.name = 'Event name is required';
  if (!d.dropZone) errors.dropZone = 'Drop zone is required';
  if (!d.city) errors.city = 'City is required';
  if (!d.state) errors.state = 'State is required';
  if (!isValidIsoDate(d.startDate)) errors.startDate = 'Start date is required';
  if (!isValidIsoDate(d.endDate)) errors.endDate = 'End date is required';
  else if (!errors.startDate && d.endDate < d.startDate) errors.endDate = 'End date cannot be before the start date';

  validateContact(d.organizer, 'organizer', errors, true);
  if (!d.organizer.phone && !d.organizer.email) errors['organizer.phone'] = 'Provide a phone number or email';
  validateJudge(d.localJudge, 'localJudge', errors, false, LOCAL_JUDGE_ROLES);
  d.remoteJudges.forEach((j, i) => validateJudge(j, `remoteJudges.${i}`, errors, true, REMOTE_JUDGE_ROLES));
  return errors;
}

export function normalizeSkydiver(input: SkydiverInput): SkydiverInput {
  let license = input.uspaLicenseNumber.trim().toUpperCase().replace(/\s+/g, '');
  const bare = /^([A-D])(\d+)$/.exec(license);
  if (bare) license = `${bare[1]}-${bare[2]}`;
  return {
    firstName: clean(input.firstName),
    lastName: clean(input.lastName),
    nickName: clean(input.nickName),
    uspaMembershipId: input.uspaMembershipId.trim(),
    membershipExpiration: input.membershipExpiration.trim(),
    uspaLicenseNumber: license,
    isVideographer: input.isVideographer === true,
  };
}

/** Expects normalized input. `excludeId` skips the skydiver being edited in the duplicate check. */
export function validateSkydiver(input: SkydiverInput, event: RecordEvent, excludeId?: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.firstName) errors.firstName = 'First name is required';
  if (!input.lastName) errors.lastName = 'Last name is required';

  if (!input.uspaMembershipId) errors.uspaMembershipId = 'USPA membership ID is required';
  else if (!MEMBERSHIP_ID.test(input.uspaMembershipId)) errors.uspaMembershipId = 'Membership ID must be digits only';
  else {
    const dup = event.skydivers.find((s) => s.uspaMembershipId === input.uspaMembershipId && s.id !== excludeId);
    if (dup) errors.uspaMembershipId = `Already in this event as #${dup.jumperNumber} ${displayName(dup)}`;
  }

  if (!input.membershipExpiration) errors.membershipExpiration = 'Expiration date is required';
  else if (!isValidIsoDate(input.membershipExpiration)) errors.membershipExpiration = 'Enter a valid date';

  // Optional, but if given it must be in USPA format.
  if (input.uspaLicenseNumber && !LICENSE.test(input.uspaLicenseNumber)) errors.uspaLicenseNumber = 'Use the USPA format, e.g. D-12345';
  return errors;
}

/** Ids ordered by jumper number. */
export function byJumperNumber(ids: string[], event: RecordEvent): string[] {
  const num = new Map(event.skydivers.map((s) => [s.id, s.jumperNumber]));
  return [...ids].sort((a, b) => (num.get(a) ?? 0) - (num.get(b) ?? 0));
}

/** The record's skydivers who go on the formation grid — everyone except videographers, by jumper number. */
export function formationIds(ids: string[], event: RecordEvent): string[] {
  const videographers = new Set(event.skydivers.filter((s) => s.isVideographer).map((s) => s.id));
  return byJumperNumber(ids.filter((id) => !videographers.has(id)), event);
}

/**
 * Clears the state unless the zone needs it, drops ids that aren't in the pool or are repeated,
 * and reconciles the formation grid with the remaining skydivers.
 */
export function normalizeRecord(input: RecordInput, event: RecordEvent): RecordInput {
  const poolIds = new Set(event.skydivers.map((s) => s.id));
  const skydiverIds = Array.from(new Set(input.skydiverIds)).filter((id) => poolIds.has(id));
  return {
    zone: input.zone,
    state: input.zone === 'state' ? input.state.trim() : '',
    type: input.type,
    skydiverIds,
    grid: reconcileGrid(input.grid, formationIds(skydiverIds, event)),
    viewpoint: isViewpoint(input.viewpoint) ? input.viewpoint : DEFAULT_VIEWPOINT,
    attemptDate: (input.attemptDate ?? '').trim(),
  };
}

/** Expects normalized input. `excludeId` skips the record being edited in the duplicate check. */
export function validateRecord(input: RecordInput, event: RecordEvent, excludeId?: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.zone) errors.zone = 'Select a zone';
  else if (!RECORD_ZONES.includes(input.zone)) errors.zone = 'Select a valid zone';

  if (input.zone === 'state') {
    if (!input.state) errors.state = 'Select a state';
    else if (!US_STATES.some((s) => s.code === input.state)) errors.state = 'Select a valid state';
  }

  if (!input.type) errors.type = 'Select a record type';
  else if (!RECORD_TYPES.includes(input.type)) errors.type = 'Select a valid record type';

  if (!input.attemptDate) errors.attemptDate = 'Record attempt date is required';
  else if (!isValidIsoDate(input.attemptDate)) errors.attemptDate = 'Enter a valid date';
  else if (!attemptInEventRange(input.attemptDate, event))
    errors.attemptDate = `Must be between ${formatDate(event.startDate)} and ${formatDate(event.endDate)}`;

  if (Object.keys(errors).length === 0) {
    const dup = event.records.find(
      (r) => r.id !== excludeId && r.zone === input.zone && r.state === input.state && r.type === input.type,
    );
    if (dup) errors.type = `This event already has a ${recordZoneText(dup)} ${recordTypeText(dup.type)} record`;
  }
  return errors;
}

export function attemptInEventRange(date: string, event: Pick<RecordEvent, 'startDate' | 'endDate'>): boolean {
  return date >= event.startDate && date <= (event.endDate || event.startDate);
}
