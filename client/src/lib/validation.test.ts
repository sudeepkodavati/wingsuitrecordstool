import { describe, expect, it } from 'vitest';
import { eventDetails, skydiverInput } from '../test/fixtures';
import type { Judge, RecordEvent } from '../types';
import { normalizeEventDetails, normalizeSkydiver, validateEventDetails, validateSkydiver } from './validation';

const emptyEvent = { skydivers: [] } as unknown as RecordEvent;

describe('validateEventDetails', () => {
  it('accepts a complete event', () => {
    expect(validateEventDetails(normalizeEventDetails(eventDetails()))).toEqual({});
  });

  it('requires core fields and organizer contact', () => {
    const errors = validateEventDetails(
      normalizeEventDetails(eventDetails({ name: ' ', dropZone: '', state: '', organizer: { name: '', phone: '', email: '' } })),
    );
    expect(errors).toMatchObject({
      name: expect.any(String),
      dropZone: expect.any(String),
      state: expect.any(String),
      'organizer.name': expect.any(String),
      'organizer.phone': 'Provide a phone number or email',
    });
  });

  it('rejects an end date before the start date', () => {
    const errors = validateEventDetails(eventDetails({ startDate: '2026-10-10', endDate: '2026-10-09' }));
    expect(errors.endDate).toMatch(/before the start/);
  });

  it('drops blank remote judge rows and requires names on partial ones', () => {
    const clean = normalizeEventDetails(
      eventDetails({
        remoteJudges: [
          { name: '', phone: '', email: '', role: '' },
          { name: '', phone: '', email: 'remote@example.com', role: 'fai' },
        ],
      }),
    );
    expect(clean.remoteJudges).toHaveLength(1);
    expect(validateEventDetails(clean)['remoteJudges.0.name']).toBe('Name is required');
  });

  it('validates judge emails', () => {
    const errors = validateEventDetails(eventDetails({ localJudge: { name: 'Sam', phone: '', email: 'not-an-email', role: 'dz-sta' } }));
    expect(errors['localJudge.email']).toBeDefined();
  });
});

describe('judge roles', () => {
  const judge = (role: string, name = 'Jo Judge') => ({ name, phone: '', email: '', role }) as Judge;

  it('leaves the local judge optional when blank', () => {
    expect(validateEventDetails(normalizeEventDetails(eventDetails()))['localJudge.role']).toBeUndefined();
  });

  it('requires a role once a local judge is entered', () => {
    const errors = validateEventDetails(normalizeEventDetails(eventDetails({ localJudge: judge('') })));
    expect(errors['localJudge.role']).toBe('Select a role');
  });

  it('requires a name when only a role is picked', () => {
    const errors = validateEventDetails(normalizeEventDetails(eventDetails({ localJudge: judge('national', '') })));
    expect(errors['localJudge.name']).toBe('Name is required');
  });

  it.each(['regional', 'national', 'dz-sta', 'fai'])('accepts %s for the local judge', (role) => {
    expect(validateEventDetails(normalizeEventDetails(eventDetails({ localJudge: judge(role) })))).toEqual({});
  });

  it.each(['regional', 'national', 'fai'])('accepts %s for a remote judge', (role) => {
    expect(validateEventDetails(normalizeEventDetails(eventDetails({ remoteJudges: [judge(role)] })))).toEqual({});
  });

  it('does not allow DZ S&TA as a remote judge', () => {
    const errors = validateEventDetails(normalizeEventDetails(eventDetails({ remoteJudges: [judge('dz-sta')] })));
    expect(errors['remoteJudges.0.role']).toBe('Select a valid role');
  });

  it('requires a role for each remote judge', () => {
    const errors = validateEventDetails(normalizeEventDetails(eventDetails({ remoteJudges: [judge('')] })));
    expect(errors['remoteJudges.0.role']).toBe('Select a role');
  });
});

describe('skydiver validation', () => {
  it('normalizes license numbers to USPA format', () => {
    expect(normalizeSkydiver(skydiverInput({ uspaLicenseNumber: ' d12345 ' })).uspaLicenseNumber).toBe('D-12345');
  });

  it('accepts a skydiver without a license number', () => {
    expect(validateSkydiver(normalizeSkydiver(skydiverInput({ uspaLicenseNumber: '  ' })), emptyEvent)).toEqual({});
  });

  it('nick name is optional', () => {
    expect(validateSkydiver(normalizeSkydiver(skydiverInput({ nickName: '' })), emptyEvent)).toEqual({});
  });

  it('requires first name, last name, membership ID, and expiration — license is optional', () => {
    const errors = validateSkydiver(
      normalizeSkydiver(
        skydiverInput({ firstName: ' ', lastName: '', uspaMembershipId: '', membershipExpiration: '', uspaLicenseNumber: '' }),
      ),
      emptyEvent,
    );
    expect(Object.keys(errors).sort()).toEqual(['firstName', 'lastName', 'membershipExpiration', 'uspaMembershipId']);
  });

  it('rejects non-numeric membership IDs and bad license formats', () => {
    const errors = validateSkydiver(
      normalizeSkydiver(skydiverInput({ uspaMembershipId: 'ABC', uspaLicenseNumber: 'X-1' })),
      emptyEvent,
    );
    expect(errors.uspaMembershipId).toMatch(/digits/);
    expect(errors.uspaLicenseNumber).toMatch(/D-12345/);
  });
});
