import { percent, type PointTransition } from '../lib/sequence';

const changeText = (t: PointTransition) => `${t.changed} of ${t.total} changed neighbours (${percent(t.changed, t.total)}%)`;

/** Results of the 75% neighbour-change rule for each change between consecutive points. */
export function PointTransitions({ transitions, compact = false }: { transitions: PointTransition[]; compact?: boolean }) {
  if (transitions.length === 0) return null;
  const failing = transitions.filter((t) => !t.passes);

  if (compact) {
    return failing.length === 0 ? (
      <span className="text-emerald-700">✓ Point changes OK</span>
    ) : (
      <span className="text-amber-700">
        ⚠ {failing.map((t) => `Point ${t.to}: ${t.changed} of ${t.total} changed`).join(' · ')} (75% needed)
      </span>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm" data-testid="point-transitions">
      <p className="font-medium text-slate-800">Point changes</p>
      <p className="text-xs text-slate-500">
        At least 75% of the skydivers must change neighbours from one point to the next: someone new next to them, or a
        neighbour on a different side. Moving the whole formation to other cells doesn't count.
      </p>
      <ul className="mt-1.5 space-y-1">
        {transitions.map((t) => (
          <li key={t.from} className={t.passes ? 'text-emerald-700' : 'text-amber-800'}>
            <span aria-hidden="true">{t.passes ? '✓' : '⚠'}</span>{' '}
            <span className="font-medium">
              Point {t.from} → Point {t.to}:
            </span>{' '}
            {changeText(t)}
            {!t.passes && ` — ${t.required - t.changed} more must change (${t.required} of ${t.total} needed).`}
          </li>
        ))}
      </ul>
    </div>
  );
}
