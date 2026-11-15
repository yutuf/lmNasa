// Touchdown mark: the Moon's outline, the horizon, and one red descent arrow touching it. Plain vector, any size.
export default function Patch({ size = 34, title = 'Touchdown' }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={title} className="patch">
      <circle cx="16" cy="16" r="13.5" fill="none" stroke="#F3F2F5" strokeWidth="2.4" />
      <path d="M5.2 21.5h21.6" stroke="#F3F2F5" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 6.5v11.2" stroke="#E10600" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M12.2 14.2 16 18l3.8-3.8" fill="none" stroke="#E10600" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
