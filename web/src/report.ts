// Per-site metrics for the comparison table, the CSV export and the printable report.
import { pointTrack, type Atlas, type Ephem, type PointResult } from './engine'
import { evaluateWindow, requiredBatteryWh, type Constraints } from './model'

export interface SiteRow {
  rank: number
  index: number
  lat: number
  lon: number
  region: string | null
  goDates: number
  windowDays: number
  bestLanding: string          // YYYY-MM-DD
  go: boolean
  sunPct: number
  earthPct: number
  longestDarkH: number
  batteryNeedWh: number
  survives: boolean
  slopeDeg: number
  heightM: number
  perStart: boolean[]          // GO on each landing date of the window
  sunDaily: number[]           // share of each mission day with >= half the Sun up (best landing date)
  earthDaily: number[]         // share of each mission day with a radio link
}

export interface Mission { start: string; windowDays: number; days: number; dsn: boolean }

export function siteRow(atlas: Atlas, eph: Ephem, dsn: ArrayLike<boolean>, r: PointResult, rank: number, q: Mission,
  c: Constraints, firstHour: number, region: string | null): SiteRow {
  const hoursN = (q.windowDays - 1) * 24 + q.days * 24
  const tr = pointTrack(atlas, eph, dsn, r.index, firstHour, hoursN)
  const ev = q.dsn ? tr.earthVisible.map((v, k) => v && !!dsn[firstHour + k]) : tr.earthVisible
  const len = q.days * 24
  const a = r.bestStart * 24
  const sf = tr.sunFraction.subarray(a, a + len)
  const w = evaluateWindow(sf, ev.slice(a, a + len), 1, c)
  const perStart = Array.from({ length: q.windowDays }, (_, s) =>
    evaluateWindow(tr.sunFraction.subarray(s * 24, s * 24 + len), ev.slice(s * 24, s * 24 + len), 1, c).go)
  const daily = (f: (k: number) => boolean) => Array.from({ length: q.days }, (_, d) => {
    let n = 0
    for (let k = 0; k < 24; k++) if (f(a + d * 24 + k)) n++
    return n / 24
  })
  return {
    rank, index: r.index, lat: r.lat, lon: ((r.lon % 360) + 360) % 360, region, goDates: r.goCount, windowDays: q.windowDays,
    bestLanding: new Date(Date.parse(q.start + 'T00:00:00Z') + r.bestStart * 86400e3).toISOString().slice(0, 10),
    go: w.go, sunPct: Math.round(w.sunFrac * 100), earthPct: Math.round(w.commFrac * 100), longestDarkH: w.longestDarkH,
    batteryNeedWh: Math.round(requiredBatteryWh(sf, 1, c)), survives: w.survived, slopeDeg: atlas.slope[r.index],
    heightM: atlas.height[r.index], perStart,
    sunDaily: daily((k) => tr.sunFraction[k] >= 0.5), earthDaily: daily((k) => ev[k]),
  }
}

const COLS: [keyof SiteRow, string][] = [['rank', 'rank'], ['lat', 'lat_deg'], ['lon', 'lon_deg_east'], ['region', 'artemis_iii_region'],
  ['goDates', 'go_landing_dates'], ['windowDays', 'landing_dates_checked'], ['bestLanding', 'best_landing_utc'], ['go', 'verdict'],
  ['sunPct', 'sunlight_pct'], ['earthPct', 'earth_contact_pct'], ['longestDarkH', 'longest_dark_h'], ['batteryNeedWh', 'battery_needed_wh'],
  ['survives', 'battery_survives'], ['slopeDeg', 'slope_deg'], ['heightM', 'height_m']]

export function toCsv(rows: SiteRow[]): string {
  const cell = (k: keyof SiteRow, v: SiteRow[keyof SiteRow]) => {
    if (k === 'go') return v ? 'GO' : 'NO-GO'
    if (typeof v === 'number') return k === 'lat' || k === 'lon' ? v.toFixed(4) : String(v)
    if (v === null) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [COLS.map(([, h]) => h).join(','), ...rows.map((r) => COLS.map(([k]) => cell(k, r[k])).join(','))].join('\n') + '\n'
}

export function download(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!)

/** A self-contained printable report (open in a new tab, then Print / Save as PDF). */
export function reportHtml(rows: SiteRow[], q: Mission, c: Constraints, sources: string[], lang: 'en' | 'tr'): string {
  const tr = lang === 'tr'
  const L = (en: string, t: string) => (tr ? t : en)
  const head = [L('#', '#'), L('Place', 'Yer'), L('GO dates', 'Uygun tarih'), L('Best landing', 'En iyi iniş'), L('Sunlight', 'Güneş'),
    L('Earth contact', 'Dünya bağlantısı'), L('Longest dark', 'En uzun karanlık'), L('Battery needed', 'Gereken batarya'), L('Slope', 'Eğim')]
  const strip = (v: number[], rgb: string) => `<div class="strip">${v.map((x) => `<i style="background:rgba(${rgb},${0.1 + 0.9 * x})"></i>`).join('')}</div>`
  const cal = (p: boolean[]) => `<div class="strip">${p.map((g) => `<i class="${g ? 'g' : 'r'}"></i>`).join('')}</div>`
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>LunaNav report</title>
<style>
body{font:14px/1.45 system-ui,sans-serif;color:#111;margin:32px;max-width:1000px}
h1{font-size:22px;margin:0}h2{font-size:16px;margin:24px 0 8px}.muted{color:#555}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f4f4f6}.go{color:#0a7d32;font-weight:700}.nogo{color:#b3261e;font-weight:700}
.strip{display:flex;gap:1px;margin:2px 0}.strip i{flex:1;height:10px;border-radius:2px}.strip i.g{background:#2fb35a}.strip i.r{background:#e5484d}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}.card{border:1px solid #ddd;border-radius:10px;padding:10px 12px}
button{padding:8px 14px;border-radius:8px;border:1px solid #888;background:#fff;cursor:pointer}
@media print{button{display:none}body{margin:12mm}}
</style></head><body>
<button onclick="print()">${L('Print / save as PDF', 'Yazdır / PDF olarak kaydet')}</button>
<h1>LunaNav · ${L('Landing site report', 'İniş yeri raporu')}</h1>
<p class="muted">${L('Generated', 'Oluşturulma')} ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</p>
<h2>${L('Mission', 'Görev')}</h2>
<p>${L('Landing window', 'İniş penceresi')}: ${esc(q.start)} + ${q.windowDays} ${L('days', 'gün')} · ${L('stay', 'kalış')} ${q.days} ${L('days', 'gün')} ·
${L('sunlight', 'güneş')} ≥ ${Math.round(c.min_sun_frac * 100)}% · ${L('Earth contact', 'Dünya bağlantısı')} ≥ ${Math.round(c.min_comm_frac * 100)}%${q.dsn ? ' (+ NASA DSN)' : ''} ·
${L('longest dark', 'en uzun karanlık')} ≤ ${c.max_dark_hours} h · ${L('battery', 'batarya')} ${c.battery_wh} Wh</p>
<h2>${L('Ranking', 'Sıralama')}</h2>
<table><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>
${rows.map((r) => `<tr><td>${r.rank}</td><td>${r.lat.toFixed(3)}°, ${r.lon.toFixed(2)}°E${r.region ? `<br><span class="muted">${esc(r.region)}</span>` : ''}</td>
<td>${r.goDates} / ${r.windowDays}</td><td>${r.bestLanding} <span class="${r.go ? 'go' : 'nogo'}">${r.go ? 'GO' : 'NO-GO'}</span></td>
<td>${r.sunPct}%</td><td>${r.earthPct}%</td><td>${r.longestDarkH} h</td><td>${r.batteryNeedWh.toLocaleString()} Wh${r.survives ? '' : ' ✕'}</td><td>${r.slopeDeg.toFixed(1)}°</td></tr>`).join('\n')}
</table>
<h2>${L('Day by day (best landing date)', 'Gün gün (en iyi iniş tarihi)')}</h2>
<div class="cards">${rows.map((r) => `<div class="card"><b>#${r.rank}</b> ${r.region ? esc(r.region) : `${r.lat.toFixed(2)}°, ${r.lon.toFixed(1)}°E`}
<div class="muted">☀ ${L('Sun up', 'Güneş')}</div>${strip(r.sunDaily, '242,183,5')}
<div class="muted">📡 ${L('Radio link', 'Radyo bağlantısı')}</div>${strip(r.earthDaily, '78,168,222')}
<div class="muted">${L('GO on each landing date', 'Her iniş tarihinde uygunluk')}</div>${cal(r.perStart)}</div>`).join('')}</div>
<h2>${L('Method and data', 'Yöntem ve veri')}</h2>
<p class="muted">${L('Sun and Earth positions from JPL DE440 hour by hour; terrain horizons ray-marched over NASA LOLA elevation maps; a site is GO when sunlight, Earth contact, longest darkness and battery all meet the mission settings. Sources', 'Güneş ve Dünya konumları saat saat JPL DE440; ufuklar NASA LOLA yükseklik haritaları üzerinde hesaplandı; güneş, Dünya bağlantısı, en uzun karanlık ve batarya görev ayarlarını karşılarsa nokta UYGUN. Kaynaklar')}: ${sources.map(esc).join(' · ')}</p>
</body></html>`
}
