import type { Accident, CarolRecord } from './types.js'

const SUMMARY_MAX_LENGTH = 260

function cleanWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function buildSummary(rec: CarolRecord): string | undefined {
  const raw =
    rec.ConcatenatedFactualNarrative?.trim() ||
    rec.ProbableCause?.trim() ||
    rec.PrelimNarrative?.trim() ||
    rec.AnalysisNarrative?.trim()

  if (!raw) return undefined
  const text = cleanWhitespace(raw)
  if (text.length <= SUMMARY_MAX_LENGTH) return text
  return text.slice(0, SUMMARY_MAX_LENGTH).trimEnd() + '…'
}

function buildInjurySummary(rec: CarolRecord): string | undefined {
  const fatal = rec.FatalInjuryCount ?? 0
  const serious = rec.SeriousInjuryCount ?? 0
  const minor = rec.MinorInjuryCount ?? 0

  const parts: string[] = []
  if (fatal > 0) parts.push(`${fatal} fatal`)
  if (serious > 0) parts.push(`${serious} serious`)
  if (minor > 0) parts.push(`${minor} minor`)

  if (parts.length > 0) return parts.join(', ')
  if (rec.HighestInjuryLevel) return rec.HighestInjuryLevel
  return undefined
}

function toIsoDate(eventDateTimeUtc: string | undefined): string | undefined {
  if (!eventDateTimeUtc) return undefined
  // Raw shape: "2010-01-01 16:08:00" (space-separated, no timezone suffix, but labeled UTC).
  const iso = `${eventDateTimeUtc.replace(' ', 'T')}Z`
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

/** Returns undefined for records that can't be normalized (missing/invalid coordinates or date). */
export function normalizeRecord(rec: CarolRecord): Accident | undefined {
  if (rec.Latitude == null || rec.Longitude == null) return undefined
  if (rec.Latitude === 0 && rec.Longitude === 0) return undefined
  // A handful of source records have corrupted coordinates (e.g. a DMS value stored without
  // decimal conversion, like latitude: 223740) — out of valid range, so drop rather than plot.
  if (rec.Latitude < -90 || rec.Latitude > 90) return undefined
  if (rec.Longitude < -180 || rec.Longitude > 180) return undefined

  const date = toIsoDate(rec.EventDateTimeUTC)
  if (!date) return undefined

  const primaryVehicle = rec.Vehicles?.[0]?.VehicleIds?.[0]
  const trimOrUndefined = (s: string | undefined): string | undefined => {
    const t = s?.trim()
    return t ? t : undefined
  }

  return {
    id: rec.NTSBNumber,
    date,
    latitude: rec.Latitude,
    longitude: rec.Longitude,
    location: trimOrUndefined(rec.City) ?? 'Unknown',
    state: trimOrUndefined(rec.StateOrRegion) ?? 'Unknown',
    aircraftMake: trimOrUndefined(primaryVehicle?.Make),
    aircraftModel: trimOrUndefined(primaryVehicle?.Model),
    registration: trimOrUndefined(primaryVehicle?.RegistrationNumber),
    fatalities: rec.FatalInjuryCount ?? undefined,
    injurySummary: buildInjurySummary(rec),
    accidentType: rec.EventType || undefined,
    summary: buildSummary(rec),
    sourceUrl: `https://web.ntsb.gov/investigations/?ntsbnumber=${encodeURIComponent(rec.NTSBNumber)}`,
  }
}
