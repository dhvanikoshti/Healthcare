# New Task: Update Reports.jsx to show uploaded reports + add delete feature

## Information Gathered
- src/pages/Reports.jsx: Static mock data, grid/list views, filters, modals (view/analysis). No localStorage integration.
- Trends.jsx/UploadReport.jsx use localStorage 'userReports' (array of {id, name, date}) and 'extractedMedicalData' (with medicalData array).
- Need to sync: Load 'userReports' on Reports page, display with details, add delete (confirm dialog, update localStorage).

## Plan
1. Replace static `reports` with `useState/useEffect` loading from localStorage 'userReports'.
2. Enhance report objects with category/status from data or defaults.
3. Add delete button/icon in cards/table, confirm dialog, remove from localStorage + extractedMedicalData (matching id/date/name).
4. Update filters/searches to work with real data.
5. Keep styling/modals intact.

## Dependent Files
- None (localStorage only).

## Followup
- Edit Reports.jsx
- Test upload/delete flow
- Dev server already running
