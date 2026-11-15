// GET /api/v1 — what this API serves, and what it does not claim.
import { handle, LIMITS, readQuery, SOURCES } from './_lib.js'

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/v1',
    summary: 'This index.',
    parameters: [],
    example: '/api/v1',
  },
  {
    method: 'GET',
    path: '/api/v1/site',
    summary: 'One landing point. Nearest grid cell, every landing day in the window, and the best day. Same default mission as the web app: 14 days on the surface, sun at least 70%, Earth contact at least 50%, longest darkness 48 h, battery 2000 Wh, slope at most 8°, 1 km touchdown zone gentler than 12°, DSN required.',
    parameters: [
      { name: 'lat', required: true, description: 'Latitude in degrees, from -90 to 90.' },
      { name: 'lon', required: true, description: 'Longitude in degrees. East-positive, from -360 to 360, so 222.7 and -137.3 are the same meridian.' },
      { name: 'start', required: false, description: 'First landing date, YYYY-MM-DD, UTC. Default 2027-09-01. Must fall inside the catalogue (2026-11-01 through 2045-12-31).' },
      { name: 'days', required: false, description: 'Hours on the surface, as a whole number of days, 1 to 30. Default 14.' },
      { name: 'window', required: false, description: 'How many landing dates to try, one per day, 1 to 90. Default 30. Cut if the catalogue runs out.' },
      { name: 'sun', required: false, description: 'Minimum sunlight, percent of hours with at least half the Sun above the terrain. 0 to 100. Default 70.' },
      { name: 'earth', required: false, description: 'Minimum Earth contact, percent of hours. 0 to 100. Default 50. With dsn=1, Earth must also have a DSN station on the Moon.' },
      { name: 'shadow', required: false, description: 'Longest darkness allowed, in hours. 0 to 240. Default 48.' },
      { name: 'batt', required: false, description: 'Battery size in Wh. 500 to 20000. Default 2000. The power model is the web app\'s: 400 W array, 150 W load.' },
      { name: 'slope', required: false, description: 'Steepest ground allowed, in degrees, at the grid point. 2 to 90. Default 8. The web app slider stops at 20.' },
      { name: 'zone', required: false, description: 'Touchdown-zone radius in metres: 0 (off), 100, 250, 500 or 1000. Default 1000. South-pole grid only.' },
      { name: 'zslope', required: false, description: '95% of the touchdown zone must be gentler than this, in degrees. 2 to 30. Default 12.' },
      { name: 'dsn', required: false, description: '1 (default) requires a DSN station as well as Earth above the horizon. 0 counts Earth above the terrain only.' },
      { name: 'series', required: false, description: '1 adds hourly sun-disc fraction, Sun altitude, Earth altitude and DSN visibility for the best day\'s stay. Default 0.' },
    ],
    example: '/api/v1/site?lat=-89.45&lon=222.7&start=2027-09-01&days=14',
  },
  {
    method: 'GET',
    path: '/api/v1/search',
    summary: 'The web app\'s south-pole search: every 2 km cell that passes the slope and touchdown checks, ranked by GO dates and then score, picks at least 6 km apart. A window that would take more than about 8 s is shortened, and the response says so.',
    parameters: [
      { name: 'start', required: false, description: 'First landing date, YYYY-MM-DD. Default 2027-09-01.' },
      { name: 'window', required: false, description: 'Landing dates to try, 1 to 90. Default 30.' },
      { name: 'days', required: false, description: 'Stay length in days, 1 to 30. Default 14.' },
      { name: 'top', required: false, description: 'How many sites to return, 1 to 50. Default 10.' },
      { name: 'sun', required: false, description: 'Minimum sunlight percent. Default 70.' },
      { name: 'earth', required: false, description: 'Minimum Earth-contact percent. Default 50.' },
      { name: 'shadow', required: false, description: 'Longest darkness allowed, hours. Default 48.' },
      { name: 'batt', required: false, description: 'Battery Wh. Default 2000.' },
      { name: 'slope', required: false, description: 'Steepest ground, degrees. Default 8.' },
      { name: 'zone', required: false, description: 'Touchdown-zone radius in metres: 0, 100, 250, 500 or 1000. Default 1000.' },
      { name: 'zslope', required: false, description: 'Zone slope limit, degrees. Default 12.' },
      { name: 'dsn', required: false, description: '1 (default) or 0. See /api/v1/site.' },
    ],
    example: '/api/v1/search?start=2027-09-01&window=30&days=14&top=10',
  },
  {
    method: 'GET',
    path: '/api/v1/sky',
    summary: 'Hourly Sun and Earth at one point: altitude, azimuth, the terrain horizon, solar-disc fraction, whether Earth is above that horizon, and whether a DSN station can see the Moon. hours is capped at 720.',
    parameters: [
      { name: 'lat', required: true, description: 'Latitude in degrees, from -90 to 90.' },
      { name: 'lon', required: true, description: 'Longitude in degrees, from -360 to 360.' },
      { name: 'from', required: false, description: 'First hour, UTC, such as 2027-09-01T00:00Z. Default 2027-09-01T00:00Z. Must be a whole hour inside the catalogue.' },
      { name: 'hours', required: false, description: 'How many hours. Default 72. Values above 720 are cut to 720, and the response says so.' },
    ],
    example: '/api/v1/sky?lat=-89.45&lon=222.7&from=2027-09-01T00:00Z&hours=72',
  },
] as const

export const INDEX = {
  name: 'AdaptLab',
  version: 'v1',
  limits: LIMITS,
  limits_detail: 'Grids are about 2 km south of 84.5°S and about 30 km elsewhere. Slopes come from a 40 m map, so boulders and small craters are invisible. This plans a mission. It does not certify a landing.',
  sources: SOURCES,
  endpoints: ENDPOINTS,
}

export default handle((req) => {
  readQuery(req, [])
  return INDEX
})
