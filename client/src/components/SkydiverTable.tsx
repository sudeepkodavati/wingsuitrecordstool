import { formatDate } from '../lib/dates';
import { membershipStatus, sortByName } from '../lib/membership';
import { displayName } from '../lib/names';
import type { RecordEvent, Skydiver } from '../types';
import { MembershipBadge } from './MembershipBadge';
import { VideographerBadge } from './VideographerBadge';

interface Props {
  event: RecordEvent;
  canEdit: boolean;
  onEdit: (skydiver: Skydiver) => void;
  onRemove: (skydiver: Skydiver) => void;
}

export function SkydiverTable({ event, canEdit, onEdit, onRemove }: Props) {
  const rows = sortByName(event.skydivers);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-2.5">#</th>
            <th scope="col" className="px-4 py-2.5">First name</th>
            <th scope="col" className="px-4 py-2.5">Last name</th>
            <th scope="col" className="px-4 py-2.5">USPA ID</th>
            <th scope="col" className="px-4 py-2.5">License</th>
            <th scope="col" className="px-4 py-2.5">Expiration</th>
            {canEdit && <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((s) => {
            const status = membershipStatus(s.membershipExpiration, event);
            return (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-semibold text-slate-900">{s.jumperNumber}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{s.firstName}</div>
                  {s.nickName && <div className="text-xs text-slate-500">“{s.nickName}”</div>}
                  {s.isVideographer && <div className="mt-1"><VideographerBadge /></div>}
                </td>
                <td className="px-4 py-3 text-slate-900">{s.lastName}</td>
                <td className="px-4 py-3 font-mono text-slate-700">{s.uspaMembershipId}</td>
                <td className="px-4 py-3 font-mono text-slate-700">{s.uspaLicenseNumber || <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="whitespace-nowrap text-slate-700">{formatDate(s.membershipExpiration)}</span>
                    {status !== 'current' && <MembershipBadge status={status} />}
                  </div>
                </td>
                {canEdit && (
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button type="button" className="text-sky-700 hover:underline" onClick={() => onEdit(s)} aria-label={`Edit ${displayName(s)}`}>
                      Edit
                    </button>
                    <button type="button" className="ml-3 text-red-600 hover:underline" onClick={() => onRemove(s)} aria-label={`Remove ${displayName(s)}`}>
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
