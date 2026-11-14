// "Team colours" for the landing regions, F1 style: each NASA Artemis III candidate region has its own strong colour,
// used on its site cards, profile pages and map. Sites outside the nine regions share one colour.
export const REGION_COLOURS: Record<string, string> = {
  'Haworth': '#27f4d2',
  'Malapert Massif': '#ff8000',
  'Mons Mouton': '#3671c6',
  'Mons Mouton Plateau': '#229971',
  'Nobile Rim 1': '#ff87bc',
  'Nobile Rim 2': '#64c4ff',
  'Peak Near Cabeus B': '#b6babd',
  'Slater Plain': '#52e252',
  'de Gerlache Rim 2': '#ffd12e',
}
export const OPEN_TERRAIN = '#9d7bff'

export function regionColour(region: string | null | undefined): string {
  return (region && REGION_COLOURS[region]) || OPEN_TERRAIN
}

/** Split a site name for the two-weight F1 heading: everything but the last word light, the last word bold. */
export function splitName(name: string): [string, string] {
  const words = name.trim().split(/\s+/)
  if (words.length < 2) return ['', name]
  // keep a trailing number or short word with the word before it: "de Gerlache" / "Rim 2"
  const n = words.length > 2 && words[words.length - 1].length <= 2 ? 2 : 1
  return [words.slice(0, -n).join(' '), words.slice(-n).join(' ')]
}
