// Touchdown mark: a lander standing on the horizon, the horizon in the brand red. Plain vector, any size.
export default function Patch({ size = 34, title = 'Touchdown' }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={title} className="patch">
      <path d="M10 9h12l2 8H8z" fill="#F3F2F5" />
      <path d="M10 17l-4 9M22 17l4 9M16 17v9" stroke="#F3F2F5" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3 27.5h26" stroke="#E10600" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}
