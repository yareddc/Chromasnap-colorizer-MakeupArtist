# Pricing Optimization Before/After Summary

Date: 2026-06-18

## Scope

This summary compares per-action profitability before and after strict token optimization.

Assumptions used:

- Token monetization: 100 tokens = $4.99
- Effective token price: $0.0499
- Target gross margin floor: 70%
- Provider-cost assumptions from pricing analyzer defaults

## Result

- All billed actions now meet or exceed the 70% gross-margin target under current assumptions.
- The main risk action (`animate_start`) moved from low margin to target-compliant.

## Before vs After (Per Action)

| Action | Tokens Before | Tokens After | Margin Before | Margin After |
| --- | ---: | ---: | ---: | ---: |
| colorize | 8 | 3 | 89.98% | 73.28% |
| upscale | 5 | 1 | 98.00% | 89.98% |
| vibrancy | 2 | 1 | 98.00% | 95.99% |
| sharpen | 2 | 1 | 98.00% | 95.99% |
| animate_start | 20 | 54 | 19.84% | 70.31% |
| beauty_consult | 3 | 1 | 95.99% | 87.98% |
| virtual_makeup | 5 | 3 | 84.37% | 73.95% |
| outfit_tryon | 6 | 3 | 86.97% | 73.95% |
| occasion_recommend | 3 | 1 | 95.99% | 87.98% |
| beauty_profile_analysis | 2 | 1 | 89.98% | 79.96% |
| complexion_report | 2 | 1 | 91.98% | 83.97% |

## Interpretation

- Previously over-margin actions were reduced to improve competitiveness while preserving margin floor.
- Animation was significantly underpriced and is now aligned with target economics.
- Image-edit features remain above target with moderate buffer.

## Files Updated

- `server/src/index.ts` action token table
- `App.tsx` account pricing constants
- `docs/feature-pricing-matrix.md` pricing matrix and examples
- `scripts/analyze-feature-profitability.mjs` analysis tooling
- `docs/profitability-recommendations.md` recommendations and runbook
