# Critical Functionality and UI/UX Requirements (KEEP UNCHANGED)

## 1. Lead Generation
- **Data Completeness**: Leads MUST include name, address, and **phone number**.
- **Source**: Scraper must reliably fetch data from "Das Örtliche".

## 2. Unternehmenssuche UI (Sidebar / Bereiche)
- **Area Cards**: Each card in the "Bereiche" sidebar must display:
    - Area Name
    - Area Description
    - **Number of Leads** currently assigned to the area.
    - **Quick Navigation**: A button/link to view the leads for that specific area.
- **Tabs**: The main view should have tabs: "Karte & Bereiche", "Leads (X)", and "Lead Generator".

## 3. Map View
- **Lead Info Popup**: Clicking a lead on the map must show a popup containing:
    - Name
    - Address
    - **Phone Number** (Critical)

## 4. Stability
- Do not change validated functionality without explicit request.
- Ensure UI consistency across updates.
- Use local OSM data for geocoding where possible to maintain speed, but prioritize data accuracy.

## 5. Validation
- All changes must be validated against existing tests.
- UI changes must be verified to match the layout shown in reference screenshots.
