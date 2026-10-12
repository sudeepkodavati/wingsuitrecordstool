import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { newId } from '../lib/ids';
import { loadCurrentOrganizerId, loadOrganizers, saveCurrentOrganizerId, saveOrganizers } from '../lib/storage';
import type { OrganizerProfile } from '../types';

/*
 * There is no login in this release. An organizer "profile" is a name + id kept in
 * this browser; events remember which profile created them so only that profile can
 * edit or delete them. This is a convenience guard, not security.
 */

interface OrganizerContextValue {
  profiles: OrganizerProfile[];
  current: OrganizerProfile | null;
  createProfile: (name: string) => OrganizerProfile;
  switchProfile: (id: string) => void;
}

const OrganizerContext = createContext<OrganizerContextValue | null>(null);

export function OrganizerProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<OrganizerProfile[]>(loadOrganizers);
  const [currentId, setCurrentId] = useState<string | null>(loadCurrentOrganizerId);

  useEffect(() => saveOrganizers(profiles), [profiles]);
  useEffect(() => {
    if (currentId) saveCurrentOrganizerId(currentId);
  }, [currentId]);

  const createProfile = useCallback((name: string) => {
    const profile = { id: newId(), name: name.trim().replace(/\s+/g, ' ') };
    setProfiles((p) => [...p, profile]);
    setCurrentId(profile.id);
    return profile;
  }, []);

  const switchProfile = useCallback((id: string) => setCurrentId(id), []);

  const value = useMemo(
    () => ({
      profiles,
      current: profiles.find((p) => p.id === currentId) ?? null,
      createProfile,
      switchProfile,
    }),
    [profiles, currentId, createProfile, switchProfile],
  );

  return <OrganizerContext.Provider value={value}>{children}</OrganizerContext.Provider>;
}

export function useOrganizer(): OrganizerContextValue {
  const ctx = useContext(OrganizerContext);
  if (!ctx) throw new Error('useOrganizer must be used inside OrganizerProvider');
  return ctx;
}
