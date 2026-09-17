# PART 06 — WEATHER

## 1. Objective
Fetch atmospheric parameters from Open-Meteo API, retain historical weather observations non-destructively, and supply deterministic weather risk scores (C4) to the DSS engine.

## 2. Requirement IDs
- WEATHER-001 through WEATHER-007
- HIST-001

## 3. UI Requirements
```
HubAtmosphericRadarCard.svelte
  → GET /api/weathers/hub → current hub weather

MonitoringMap.svelte (zone weather overlay)
  → GET /api/weathers/zone/:zoneId → zone-specific weather
```

## 4. User Stories
- As a dashboard viewer, I need to see current weather conditions so I understand field conditions.
- As the DSS engine, I need weather risk scores so zone rankings factor in weather.

## 5. Functional Requirements
| ID | Requirement |
|:---:|---|
| WEATHER-001 | Fetch weather from Open-Meteo API |
| WEATHER-002 | Append-only storage (no DELETE) — ADR-003 |
| WEATHER-003 | Latest via ORDER BY updated_at DESC LIMIT 1 |
| WEATHER-004 | 30-minute TTL cache per zone (1800s) |
| WEATHER-005 | C4 Weather Risk = Cost criterion |
| WEATHER-006 | Hub-level weather endpoint |
| WEATHER-007 | Zone-level weather endpoint |

## 6. State Machine
N/A

## 7. API Contract

### GET /api/weathers/hub
- **Role:** Authenticated
- **Response 200:** `{ city_name, weather: { temperature_2m, precipitation_probability, rain, humidity } }`

### GET /api/weathers/zone/:zoneId
- **Role:** Authenticated
- **Response 200:** `{ zone_id, current_weather: { temperature_2m, precipitation_probability, rain } }`
- **Error 404:** `{ msg: "Zone not found" }`

## 8-9. Request/Response Schema
See API Contract above.

## 10. Error Contract
| Status | Code | When |
|:---:|---|---|
| 404 | `ZONE_NOT_FOUND` | Invalid zone ID |
| 503 | `WEATHER_SERVICE_UNAVAILABLE` | Open-Meteo API timeout |

## 11. Business Rules
- Weather observations are APPEND-ONLY — never DELETE historical data
- C4 score normalized: higher precipitation = higher cost = lower zone desirability
- Cache valid for 30 minutes (1800s) per zone before re-fetch

## 12. Database Dependencies
| Table | Purpose | Lifecycle |
|---|---|---|
| `weathers` | Weather observations per zone | HISTORICAL / APPEND-ONLY |
| `zones` | Zone coordinate reference | Referenced |
| `system_settings` | Hub city for weather query | Referenced |

## 13. Service Dependencies
- `WeatherOperationalEvaluator.ts`, `POIWeatherService.ts`, `OperationalContextService.ts`

## 14. Repository Dependencies
- `WeatherRepository.ts`

## 15. Worker Dependencies
None direct. Weather may be refreshed by cron.

## 16. Files Allowed to Modify
- `src/repositories/WeatherRepository.ts`
- `src/controllers/weatherController.ts`
- `src/services/poi/POIWeatherService.ts`

## 17. Files Forbidden to Modify
- Fleet management, BWM Saaty solver

## 18. Dependencies on Other PARTs
- Depends on: PART 01, PART 04

## 19. Acceptance Criteria
- [x] Weather observations append without deleting past logs
- [x] Latest weather via ORDER BY updated_at DESC LIMIT 1
- [x] C4 weather score returns normalized float between 0 and 100

## 20. Test Cases
- `tests/report_and_attendance.test.ts` (Test 8.1)

## 21. Verification Commands
```bash
bun run tests/report_and_attendance.test.ts
```

## 22. Known Risks
- Open-Meteo API network latency / downtime

## 23. Open Decisions
None.

## 24. Current Implementation Status
- Destructive DELETE removed (ADR-003)
- Hub weather resolves city from OperationalContextService
- Fully functional and verified

## 25. Reconstruction Checklist
- [x] REQUIREMENTS_VERIFIED
- [x] UI_CONTRACT_VERIFIED
- [x] API_CONTRACT_VERIFIED
- [x] DATA_MODEL_VERIFIED
- [x] BUSINESS_RULES_VERIFIED
- [x] IMPLEMENTATION_COMPLETE
- [x] TESTS_PASS (12/12 PASS)
- [x] INTEGRATION_VERIFIED
- [x] REGRESSION_VERIFIED (131/131 TOTAL PASS)
- [x] DOCUMENTATION_UPDATED

**PART STATUS: COMPLETED**

## 26. Progress Log
| Date | Action | Result |
|:---:|---|---|
| 2026-09-03 | Destructive DELETE removed | ADR-003 applied |
| 2026-09-03 | Requirements verified | All criteria met |
| 2026-09-03 | PART 06 Test Suite Executed | 12/12 Unit & Integration Tests PASS |
