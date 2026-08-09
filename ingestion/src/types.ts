/** Full normalized shape, per action-plan.md. Split into two files on write (see index.ts) so
 * the browser only downloads what it needs to draw the map up front — see AccidentPoint. */
export interface Accident {
  id: string
  date: string
  latitude: number
  longitude: number
  location: string
  state: string
  aircraftMake?: string
  aircraftModel?: string
  registration?: string
  fatalities?: number
  injurySummary?: string
  accidentType?: string
  summary?: string
  sourceUrl: string
}

/** accidents.json — everything needed to render/cluster/color the map and filter by state/year.
 * `year` (not the full date) keeps this file lean — it's only used for the year-range filter.
 * Mirrored in src/types/accident.ts. */
export interface AccidentPoint {
  id: string
  latitude: number
  longitude: number
  state: string
  year: number
  fatalities?: number
}

/** accident-details.json — keyed by id, fetched in the background after the map is already
 * showing, and merged with an AccidentPoint when the user clicks a marker. */
export interface AccidentDetail {
  date: string
  location: string
  aircraftMake?: string
  aircraftModel?: string
  registration?: string
  injurySummary?: string
  accidentType?: string
  summary?: string
  sourceUrl: string
}

/** Raw shape returned by api.ntsb.gov/searchpub/api/Carol/v1/GetCustomSearchJson (undocumented). */
export interface CarolVehicleId {
  Make?: string
  Model?: string
  RegistrationNumber?: string
  AircraftCategory?: string
  DamageLevel?: string
}

export interface CarolVehicle {
  VehicleNumber: number
  VehicleIds: CarolVehicleId[]
}

export interface CarolRecord {
  MKey: number
  NTSBNumber: string
  CompletionStatus?: string
  HighestInjuryLevel?: string
  Mode: string
  TopicMode?: string
  Latitude: number | null
  Longitude: number | null
  City?: string
  StateOrRegion?: string
  Country?: string
  EventType?: string
  EventDateTimeUTC?: string
  FatalInjuryCount?: number
  SeriousInjuryCount?: number
  MinorInjuryCount?: number
  ProbableCause?: string
  AnalysisNarrative?: string
  ConcatenatedFactualNarrative?: string
  PrelimNarrative?: string
  Vehicles?: CarolVehicle[]
}
