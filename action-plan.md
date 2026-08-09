Build an MVP aviation accident visualization web app using CesiumJS.

GOAL
Create an interactive 3D globe/map showing historical aviation accidents in the United States. Users should be able to visually identify areas with higher concentrations of accidents and click individual accidents to inspect the incident.

TECH STACK
- Use the existing project's framework and conventions.
- CesiumJS for the map/globe.
- TypeScript.
- Reuse the existing backend if one exists.
- Do not introduce unnecessary frameworks or infrastructure.
- Keep the implementation simple enough to deploy today.

DATA
Use publicly available NTSB aviation accident data.

For the MVP, normalize each accident into approximately:

{
  id: string,
  date: string,
  latitude: number,
  longitude: number,
  location: string,
  state: string,
  aircraftMake?: string,
  aircraftModel?: string,
  registration?: string,
  fatalities?: number,
  injurySummary?: string,
  accidentType?: string,
  summary?: string,
  sourceUrl: string
}

If obtaining the live NTSB dataset directly is difficult, create a small ingestion script that downloads/imports the public dataset and converts it into this normalized format.

Do NOT manually hardcode accident records.

MAP
- Display a Cesium globe centered on the continental United States.
- Display accident locations.
- Use clustering where appropriate so thousands of points do not overwhelm the map.
- Clicking an individual accident should open an information panel.

ACCIDENT PANEL
Show:
- Date
- Location
- State
- Aircraft make/model
- Registration if available
- Fatalities if available
- Short accident summary if available
- "View NTSB Source" link

The source link must point to the actual underlying NTSB record/source.

RISK / DENSITY VISUALIZATION
Create a simple geographic accident-density visualization.

Use a grid or geographic clustering approach rather than attempting a sophisticated statistical risk model.

Classification:
- RED = highest accident concentration
- ORANGE = medium concentration
- YELLOW = lower but meaningful concentration
- No color = little/no accident activity

IMPORTANT:
These colors represent HISTORICAL ACCIDENT CONCENTRATION ONLY.
Do not label the map as predicting accident risk or claiming that an area is inherently dangerous.

Allow the user to toggle the density layer on/off.

UI
Keep the UI minimal and modern.

Controls:
- Density layer toggle
- Accident markers toggle
- Reset/return-to-US view
- Basic search/filter by state if easy to implement

Clicking an accident should select it and open its details.

PERFORMANCE
- Do not render every accident as an individual entity when zoomed far out.
- Use Cesium clustering or an equivalent efficient approach.
- Avoid loading unnecessary data into the browser.
- Keep the API/data payload reasonably small.

ARCHITECTURE
Prefer:

NTSB public data
      ↓
ingestion/normalization
      ↓
normalized accident dataset
      ↓
API
      ↓
CesiumJS frontend

If the project already has a backend, add the necessary endpoint there.

Suggested endpoint:

GET /api/aviation/accidents

Optional query parameters:
- state
- startDate
- endDate
- limit

For the initial MVP, returning all US records is acceptable if the dataset is reasonably sized. Otherwise implement geographic/bounding-box filtering.

DELIVERABLE
The application must actually run locally and be deployable.

Before finishing:
1. Run the application.
2. Verify the Cesium globe renders.
3. Verify accident data appears.
4. Verify clustering works.
5. Verify density visualization works.
6. Verify clicking an accident opens its details.
7. Verify the NTSB source link works.
8. Fix any TypeScript/build/runtime errors.

DO NOT BUILD YET
- User accounts
- Authentication
- AI summaries
- Emergency-frequency layer
- Live ADS-B
- ML prediction
- Complex analytics dashboards
- Mobile app
- Admin interface
- Sophisticated risk modeling

The priority is SHIPPING A WORKING MVP TODAY.