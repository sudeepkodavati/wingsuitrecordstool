import type { Viewpoint } from '../types';

/**
 * Pictogram of where the formation is viewed from: an eye looking at the formation plane,
 * from above (top-down) or from behind (back-to-front). Mirrored in pdf/documents.ts.
 */
export function ViewpointIcon({ viewpoint, className = '' }: { viewpoint: Viewpoint; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {viewpoint === 'top-down' ? (
        <>
          {/* formation plane, seen in perspective */}
          <path d="M6 54 L20 42 H58 L44 54 Z" className="fill-sky-100 stroke-sky-700" strokeWidth={2} />
          <circle cx="24" cy="48" r="2.5" className="fill-sky-700" />
          <circle cx="32" cy="48" r="2.5" className="fill-sky-700" />
          <circle cx="40" cy="48" r="2.5" className="fill-sky-700" />
          {/* line of sight, down */}
          <path d="M32 22 V36 M27 31 L32 36 L37 31" className="stroke-slate-500" strokeWidth={2.5} />
          {/* eye */}
          <path d="M18 12 Q32 0 46 12 Q32 24 18 12 Z" className="fill-white stroke-slate-800" strokeWidth={2.5} />
          <circle cx="32" cy="12" r="4" className="fill-slate-800" />
        </>
      ) : (
        <>
          {/* formation plane, standing upright */}
          <path d="M42 14 L58 6 V50 L42 58 Z" className="fill-sky-100 stroke-sky-700" strokeWidth={2} />
          <circle cx="50" cy="22" r="2.5" className="fill-sky-700" />
          <circle cx="50" cy="32" r="2.5" className="fill-sky-700" />
          <circle cx="50" cy="42" r="2.5" className="fill-sky-700" />
          {/* line of sight, forward */}
          <path d="M24 32 H37 M32 27 L37 32 L32 37" className="stroke-slate-500" strokeWidth={2.5} />
          {/* eye */}
          <path d="M2 32 Q12 20 22 32 Q12 44 2 32 Z" className="fill-white stroke-slate-800" strokeWidth={2.5} />
          <circle cx="12" cy="32" r="4" className="fill-slate-800" />
        </>
      )}
    </svg>
  );
}
