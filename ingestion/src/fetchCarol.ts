import type { CarolRecord } from './types.js'

const ENDPOINT = 'https://api.ntsb.gov/searchpub/api/Carol/v1/GetCustomSearchJson'

/**
 * This is the same subscription key NTSB's own public search frontend (my.ntsb.gov)
 * ships to every visitor's browser to call its public, anonymous, unauthenticated
 * search API — not a private credential. It's undocumented, so NTSB could rotate or
 * rate-limit it without notice; treat this integration as best-effort.
 */
const SUBSCRIPTION_KEY = 'e8ccd674074a43ff8766bc1d61500cf7'

/** Confirmed empirically: this endpoint silently ignores `paging.startIndex` and always
 * returns the same first N records, hard-capped at 10,000. There is no working pagination.
 * The only way to get the full dataset is to keep each query's result set under the cap —
 * we do that by chunking on EventDate per calendar year (nationwide Aviation accidents run
 * roughly 1,500–4,500/year, comfortably under 10,000). */
const PAGE_SIZE_CAP = 10000

export async function fetchYear(year: number): Promise<CarolRecord[]> {
  const from = `${year}-01-01`
  const to = `${year + 1}-01-01`

  const body = {
    userName: 'anonymous',
    paging: { pageSize: PAGE_SIZE_CAP, startIndex: 0 },
    sorting: { sortingFilters: [] },
    filter: {
      operator: 'All',
      groups: [
        {
          operator: 'All',
          associations: [
            {
              operator: 'All',
              criteria: [
                { field: 'EventDate', operator: 'GreaterThanEqualTo', value: from },
                { field: 'EventDate', operator: 'LessThan', value: to },
              ],
            },
            {
              operator: 'All',
              criteria: [{ field: 'casedetail.TopicMode', operator: 'Contains', value: 'Aviation' }],
            },
            {
              // NTSB investigates some foreign occurrences involving US-registered/manufactured
              // aircraft (e.g. treaty obligations) — out of scope for a "US accidents" map.
              operator: 'All',
              criteria: [{ field: 'Country', operator: 'Equals', value: 'USA' }],
            },
          ],
        },
      ],
    },
    timeZone: 'UTC',
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`CAROL API request failed for year ${year}: ${res.status} ${res.statusText}`)
  }

  const records = (await res.json()) as CarolRecord[]

  if (records.length >= PAGE_SIZE_CAP) {
    console.warn(
      `WARNING: year ${year} returned ${records.length} records (>= the ${PAGE_SIZE_CAP} cap). ` +
        `This year is being truncated — split it further (e.g. by half-year or by state) if this happens.`,
    )
  }

  return records
}
