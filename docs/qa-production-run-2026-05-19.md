# Production QA Run - 2026-05-19

> ⚠️ **Deprecated:** This QA run covered the Colorizer feature, which has since been removed from the codebase. Colorizer references below are historical.


## Scope
- Authenticated deep feature pass
- Colorizer monochrome and processing validation
- Barbershop recommendation and generation checks
- Account center refresh and billing usage checks

## Bug 1
### Title
Barbershop recommendations API returns 500 for valid authenticated request

### Severity
High

### Environment
- Date: 2026-05-19
- URL: https://chromasnap.app/?t=style-fix-verify
- Platform: VS Code integrated browser
- Account: smoke_1779033492378
- Feature: Dedicated Feature Barbershop Visit

### Reproduction Steps
1. Login with authenticated user.
2. Open Dedicated Feature Barbershop Visit.
3. Ensure a selfie is present and click Get Ideas.
4. Observe request outcome.

### Expected Result
Recommendations are returned and shown in UI.

### Actual Result
Endpoint returns 500 and UI shows generic failure message.

### Evidence
- Endpoint: /api/recommend/occasion-look
- Status: 500
- Response body: {"error":"Failed to generate recommendations"}
- Request latency observed in Cloud Run request log: about 30.48s
- Trace id: projects/chrommasnap-vertex-ai-use/traces/6628b29d525a5db18b943fd536fc9842

### Technical Notes
- Backend returns 500 when fullText is empty in recommendation handler.
- No detailed exception text is currently emitted for this path in recent Cloud Run stdout or stderr logs.

## Bug 2
### Title
Colorizer sample image path fails with unsupported image format and upstream 500 checks

### Severity
High

### Reproduction Steps
1. Open Colorizer.
2. Click Try sample image.
3. Click Run with default colorize command.

### Expected Result
Sample black and white image colorizes successfully.

### Actual Result
Console shows multiple 500-related failures and unsupported image format.

### Evidence
- Console: Monochromatic check failed
- Console: Safety check API failed
- Console: Colorization API Error: Input buffer contains unsupported image format
- UI: Something went wrong. Please try again.

### Technical Notes
- Sample image is an SVG data URL in frontend, while backend image pipeline appears to expect raster-compatible buffers for some operations.

## Bug 3
### Title
Colorizer true grayscale raster can enter prolonged processing state without completion

### Severity
Medium

### Reproduction Steps
1. Convert public/Eritrean man.jpeg to grayscale raster and upload in Colorizer.
2. Apply photo in editor and click Run.
3. Observe processing state for at least 60 seconds.

### Expected Result
Operation completes with success or explicit failure.

### Actual Result
UI remains at Applying Cinematic palette with no completion or visible error in the observed window.

### Evidence
- Generated test input: public/bw_smoke_test.jpg
- UI state persisted beyond 60 seconds with active loading overlay.

### Technical Notes
- Potential long-running backend operation, missing timeout propagation, or missing completion/error signal in client state path.

## Non-Bug Validations
- Login and workspace navigation succeeded.
- Account refresh updated token balance and usage.
- Upload and photo editor opened in tested feature pages.

## Post-Fix Validation (Deployed)
- Deployment: Cloud Build 4a681161-504d-4a60-bc79-310cecd9ec2b status SUCCESS.
- Endpoint recheck: POST /api/recommend/occasion-look now returns HTTP 200 with fallback recommendations payload.
- Sample response keys observed: recommendations, fallback=true, message.
- Result: previous hard 500 for the barbershop recommendations request path is mitigated server-side.

## Local Follow-Up Changes (Ready For Deploy)
- Frontend Barbershop flow now preserves backend response messages and uses separate loading state for Get Ideas vs Generate Look.
- Colorizer sample input now loads a raster grayscale asset instead of an inline SVG data URL.
- Added targeted server regression coverage for occasion recommendation fallback and parser normalization.
