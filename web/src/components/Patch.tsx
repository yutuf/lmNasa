// LunaNav mission patch: the Moon's south-polar limb seen from orbit, the descent arc to a landing point near the
// pole, the Sun low on the horizon and Earth above it; a red rim like the brand accent. Plain SVG, scales anywhere.
export default function Patch({ size = 34, title = 'LunaNav' }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} className="patch">
      <defs>
        <clipPath id="patch-in"><circle cx="32" cy="32" r="27" /></clipPath>
        <linearGradient id="patch-moon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9e6df" />
          <stop offset="1" stopColor="#8d8a84" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill="#e10600" />
      <circle cx="32" cy="32" r="28.2" fill="#0b0c14" />
      <g clipPath="url(#patch-in)">
        {/* the Moon's limb, south pole at the bottom of the patch */}
        <circle cx="32" cy="70" r="34" fill="url(#patch-moon)" />
        <path d="M6 44 q8 -3 14 -1 q5 2 9 -1 q6 -3 12 0 q5 2 9 0 q5 -2 9 1" fill="none" stroke="#5f5c57" strokeWidth="1.2" />
        <circle cx="22" cy="49" r="2.4" fill="#6f6b65" /><circle cx="44" cy="51" r="3" fill="#6f6b65" />
        {/* Sun skimming the horizon, Earth above */}
        <circle cx="54" cy="38" r="3.2" fill="#ffc83d" /><circle cx="54" cy="38" r="6" fill="#ffc83d" opacity=".25" />
        <circle cx="16" cy="18" r="4.2" fill="#3b82f6" /><path d="M12.6 17 q3 -2 6 1" stroke="#7cc4ff" strokeWidth="1" fill="none" />
        {/* descent arc to the landing point */}
        <path d="M10 30 Q30 14 36 37" fill="none" stroke="#fff" strokeWidth="1.6" strokeDasharray="2.6 2.2" strokeLinecap="round" />
        <path d="M36 37 l-2.2 -3.6 l4.4 0.6 z" fill="#fff" />
        <circle cx="36" cy="38.6" r="1.6" fill="#e10600" />
      </g>
      <circle cx="32" cy="32" r="28.2" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth=".8" />
    </svg>
  )
}
