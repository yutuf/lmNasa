// AdaptLab mark: the Moon's limb on the horizon with a low red Sun skimming it, the south pole's defining light.
export default function Patch({ size = 34, title = 'AdaptLab' }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={title} className="patch">
      <path d="M3 22a13 13 0 0 1 26 0" fill="none" stroke="#F3F2F5" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M3 22h26" stroke="#F3F2F5" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="9.5" cy="19" r="3" fill="#E10600" />
    </svg>
  )
}
