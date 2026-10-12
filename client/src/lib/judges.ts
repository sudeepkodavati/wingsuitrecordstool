import type { Judge, JudgeRole } from '../types';

export const JUDGE_ROLE_LABELS: Record<JudgeRole, string> = {
  regional: 'Regional Judge',
  national: 'National Judge',
  'dz-sta': 'DZ S&TA',
  fai: 'FAI',
};

export const LOCAL_JUDGE_ROLES: JudgeRole[] = ['regional', 'national', 'dz-sta', 'fai'];
export const REMOTE_JUDGE_ROLES: JudgeRole[] = ['regional', 'national', 'fai'];

export const emptyJudge = (): Judge => ({ name: '', phone: '', email: '', role: '' });

/** Events saved before judge roles existed have no `role` field. */
export function withRole(j: Partial<Judge> | undefined): Judge {
  return { ...emptyJudge(), ...j, role: j?.role ?? '' };
}

export function judgeRoleLabel(role: Judge['role'] | undefined): string {
  return role ? JUDGE_ROLE_LABELS[role] ?? '' : '';
}
