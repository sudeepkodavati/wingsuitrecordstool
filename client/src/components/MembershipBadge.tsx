import type { MembershipStatus } from '../lib/membership';

const STYLES: Record<MembershipStatus, { label: string; className: string }> = {
  current: { label: 'Current', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  'expires-during-event': { label: 'Expires during event', className: 'bg-amber-50 text-amber-800 ring-amber-600/30' },
  expired: { label: 'Expired', className: 'bg-red-50 text-red-700 ring-red-600/20' },
};

export function MembershipBadge({ status }: { status: MembershipStatus }) {
  const { label, className } = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {status !== 'current' && <span aria-hidden="true">⚠</span>}
      {label}
    </span>
  );
}
