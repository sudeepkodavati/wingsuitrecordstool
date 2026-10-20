import { percent, type PointTransition } from '../lib/sequence';

/** Results of the organizer's marks for each change between consecutive points (75% rule). */
export function PointTransitions({ transitions, compact = false }: { transitions: PointTransition[]; compact?: boolean }) {
  if (transitions.length === 0) return null;
  const failing = transitions.filter((t) => !t.passes);

  if (compact) {
    return failing.length === 0 ? (
      <span className="text-emerald-700">✓ Point changes OK</span>
    ) : (
      <span className="text-amber-700">
        ⚠ {failing.map((t) => `Point ${t.to}: ${t.marked} of ${t.total} marked`).join(' · ')} (75% needed)
      </span>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" data-testid="point-transitions">
      <p className="font-medium text-slate-800">Point changes</p>
      <p className="text-xs text-slate-500">
        At least 75% of the skydivers must change slot from one point to the next. On each point, tick who changed slot.
      </p>
      <ul className="mt-1.5 space-y-1">
        {transitions.map((t) => (
          <li key={t.from} data-testid={`transition-${t.from}-${t.to}`} className={t.passes ? 'text-emerald-700' : 'text-amber-800'}>
            <span aria-hidden="true">{t.passes ? '✓' : '⚠'}</span>{' '}
            <span className="font-medium">
              Point {t.from} → Point {t.to}:
            </span>{' '}
            {t.marked} of {t.total} marked as changed ({percent(t.marked, t.total)}%)
            {!t.passes && ` — ${t.required - t.marked} more needed (${t.required} of ${t.total}).`}
          </li>
        ))}
      </ul>
    </div>
  );
}
