# Feature Pricing Matrix

This matrix maps the current user-facing studio buttons to the billing action keys defined in [server/src/index.ts](../server/src/index.ts).

## Token-Charged Actions

| Workspace | UI button / action | Billing action key | Endpoint | Tokens | Notes |
| --- | --- | --- | --- | ---: | --- |
| Colorizer | Colorize | `colorize` | `/api/process/colorize` | 3 | Main image colorization request. |
| Colorizer | 4K Upscale | `upscale` | `/api/process/upscale` | 1 | Optional enhancement after colorization. |
| Colorizer | Vibrant | `vibrancy` | `/api/process/vibrancy` | 1 | Optional saturation enhancement. |
| Colorizer | Sharpen | `sharpen` | `/api/process/sharpen` | 1 | Optional detail enhancement. |
| Animate | Animate | `animate_start` | `/api/process/animate/start` | 54 | Charged when starting the animation job. |
| Colorizer result view | Animate This Photo | `animate_start` | `/api/process/animate/start` | 54 | Same animation charge, launched from a colorized result. |
| Beauty Lab | Get Ideas | `occasion_recommend` | `/api/recommend/occasion-look` | 1 | Occasion-based look recommendations. |
| Beauty Lab | Consult Notes | `beauty_consult` | `/api/consult/beauty-advisor` | 1 | Written consultation using the notes box. |
| Beauty Lab | Generate | `virtual_makeup` | `/api/generate/virtual-makeup` | 3 | Creates the Beauty Lab after-image. |
| Beauty Lab | Generate 360 Preview | `virtual_makeup` | `/api/generate/virtual-makeup` | 3 | Generates descriptive hairstyle preview data without image output. |
| Beauty Lab | Analyze Profile | `beauty_profile_analysis` | `/api/analyze/beauty-profile` | 1 | Face, skin, eye, and hair profile analysis. |
| Beauty Lab | Complexion Report | `complexion_report` | `/api/analyze/complexion-report` | 1 | Complexion scan and product/style suggestions. |
| Barbershop | Get Ideas | `occasion_recommend` | `/api/recommend/occasion-look` | 1 | Barbershop recommendation set. |
| Barbershop | Generate Look | `virtual_makeup` | `/api/generate/virtual-makeup` | 3 | Creates the barbershop after-image. |
| Barbershop | Left / Right / Back angle buttons | `virtual_makeup` | `/api/generate/virtual-makeup` | 3 each | First click on each non-front angle triggers a new generation, then the preview is cached for that session. |
| Outfit Studio | Generate Outfit | `outfit_tryon` | `/api/generate/outfit-tryon` | 3 | One request charge even if batch count is 2 or 3 looks. |

## Feature Totals

| Feature flow | Tokens |
| --- | ---: |
| Colorize image | 3 |
| Animate image | 54 |
| Barbershop full flow (`Get Ideas` + `Generate Look`) | 4 |
| Beauty Lab core flow (`Get Ideas` + `Consult Notes` + `Generate`) | 5 |
| Outfit Studio generation | 3 |

## Zero-Cost Buttons

These buttons do not trigger a billed backend processing action:

| Workspace | Zero-cost buttons |
| --- | --- |
| Colorizer / Animate | Upload, Camera, Download HD, Share, Reset, Undo |
| Beauty Lab | Upload, Camera, Download Photo, Download Card, Reset, Apply to Beauty Lab, all style/slider selectors |
| Barbershop | Upload, Camera, Download, Reset, haircut/style selectors, notes entry |
| Outfit Studio | Upload, Camera, Upload Garment, Download, Reset, style/palette selectors |

## Dollar Conversion

The repository stores feature cost in tokens, not in dollars. To estimate dollar cost:

`feature cost in money = tokens required × price per token`

Examples:

- If 100 tokens cost `$4.99`, then one token costs `$0.0499`.
- Colorize would be `3 × 0.0499 = about $0.15`.
- Animate would be `54 × 0.0499 = about $2.69`.

Use the calculator script to do that automatically:

```bash
npm run pricing:features -- --pack-price 4.99 --pack-tokens 100
```

## JSON Export

The calculator also exports machine-readable JSON for dashboards, admin tools, or CI checks.

```bash
npm run pricing:features:json
```

or with price conversion inputs:

```bash
node scripts/calculate-feature-costs.mjs --json --pack-price 4.99 --pack-tokens 100
```

The JSON currently includes:

- Action token costs
- Per-button UI mappings
- Feature bundle totals
- Subscription plan allowances
- Default Google Play product mappings
- Zero-cost UI actions

## Subscription Plans

| Plan | Tokens / month | Monthly top-up cap |
| --- | ---: | ---: |
| Free | 50 | 100 |
| Pro | 1000 | 5000 |
| Enterprise | 10000 | 50000 |

These values come from the backend billing configuration in [server/src/index.ts](../server/src/index.ts).

## Google Play Product Mappings

Default fallback product IDs defined by the backend purchase verification logic:

### Subscriptions

| Tier | Product ID |
| --- | --- |
| Pro | `chromasnap_pro` |
| Enterprise | `chromasnap_enterprise` |

### Token top-ups

| Tokens | Product ID |
| ---: | --- |
| 100 | `chromasnap_topup_100` |
| 500 | `chromasnap_topup_500` |
| 1000 | `chromasnap_topup_1000` |

These are fallback IDs and may be overridden by runtime environment variables.

## Purchase Flow Mapping

| Scenario | Flow |
| --- | --- |
| Web / local development | `POST /api/subscription/subscribe` and `POST /api/subscription/topup` when direct billing mutations are enabled |
| Android production | Google Play purchase flow, then `POST /api/billing/google-play/verify` |
| Google Play subscription purchase | Maps product ID to plan tier and resets monthly token allowance |
| Google Play top-up purchase | Maps product ID to token amount and adds tokens to the current account |

Important behavior:

- Direct subscription changes are blocked for Android clients.
- Direct subscription and top-up changes can also be blocked in production-hardened mode.
- `Generate Outfit` is billed once per request even if multiple looks are returned.
- Barbershop left/right/back preview angles each trigger an extra billed generation the first time they are requested.
