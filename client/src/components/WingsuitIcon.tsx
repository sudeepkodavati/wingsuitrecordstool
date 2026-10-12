/** Top-down wingsuit flyer: arm wings from shoulder to hip, a tail wing between the legs, and the jumper number on the chest. */
export function WingsuitIcon({ number, className = '' }: { number: number; className?: string }) {
  const label = String(number);
  const fontSize = label.length >= 3 ? 19 : label.length === 2 ? 25 : 29;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g className="fill-current">
        <circle cx="50" cy="10" r="8" />
        {/* arm wings */}
        <path d="M43 22 L2 50 L6 58 L43 66 Z" />
        <path d="M57 22 L98 50 L94 58 L57 66 Z" />
        {/* torso */}
        <rect x="36" y="18" width="28" height="50" rx="9" />
        {/* leg wing */}
        <path d="M38 62 L28 98 L50 89 L72 98 L62 62 Z" />
      </g>
      <circle cx="50" cy="44" r="20" className="fill-white" />
      <text
        x="50"
        y="45"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={700}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        className="fill-slate-900"
      >
        {label}
      </text>
    </svg>
  );
}
