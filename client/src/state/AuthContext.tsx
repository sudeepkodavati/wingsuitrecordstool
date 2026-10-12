import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getSupabase } from '../lib/supabase';

export type Role = 'admin' | 'organizer';

/**
 * - loading: checking for an existing session
 * - signed-out: show the login screen
 * - no-role: signed in, but the admin hasn't given this account a role (no access)
 * - signed-in: has a role
 */
export type AuthStatus = 'loading' | 'signed-out' | 'no-role' | 'signed-in';

export interface AuthValue {
  status: AuthStatus;
  userId: string | null;
  email: string;
  role: Role | null;
  /** From user_roles.display_name; falls back to the email. */
  displayName: string;
  /** Resolves with an error message, or null on success. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);

function signInMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(message)) return 'This account has not been confirmed yet. Ask your administrator.';
  return 'Could not sign in. Please try again.';
}

/** Supabase Auth session + the user's role from public.user_roles. Accounts are created by an admin. */
export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ userId: string; email: string } | null | undefined>(undefined);
  const [roleInfo, setRoleInfo] = useState<{ role: Role | null; displayName: string } | undefined>(undefined);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setSession(u ? { userId: u.id, email: u.email ?? '' } : null);
    });
    // Keep this callback synchronous: calling Supabase from inside it can deadlock.
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      const u = s?.user;
      setSession(u ? { userId: u.id, email: u.email ?? '' } : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.userId ?? null;
  useEffect(() => {
    if (!userId) {
      setRoleInfo(undefined);
      return;
    }
    let cancelled = false;
    setRoleInfo(undefined);
    getSupabase()
      .from('user_roles')
      .select('role, display_name')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const role = data?.role === 'admin' || data?.role === 'organizer' ? (data.role as Role) : null;
        setRoleInfo({ role, displayName: data?.display_name ?? '' });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    return error ? signInMessage(error.message) : null;
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
  }, []);

  const value = useMemo<AuthValue>(() => {
    const status: AuthStatus =
      session === undefined || (session && roleInfo === undefined)
        ? 'loading'
        : !session
          ? 'signed-out'
          : roleInfo?.role
            ? 'signed-in'
            : 'no-role';
    return {
      status,
      userId,
      email: session?.email ?? '',
      role: roleInfo?.role ?? null,
      displayName: roleInfo?.displayName || session?.email || '',
      signIn,
      signOut,
    };
  }, [session, roleInfo, userId, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an auth provider');
  return ctx;
}
