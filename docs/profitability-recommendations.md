# Profitability Recommendations

This report translates token charges into business profitability and proposes token adjustments to hit a margin target.

## Inputs

- Token pricing source: `server/src/index.ts` action table.
- Revenue side: your token pack or subscription implied `price per token`.
- Provider-cost side: baseline per-call assumptions based on current model routing.

## Run the calculator

```bash
npm run pricing:profitability -- --pack-price 4.99 --pack-tokens 100
```

or:

```bash
npm run pricing:profitability -- --price-per-token 0.05 --target-margin 0.7
```

JSON output:

```bash
npm run pricing:profitability:json -- --pack-price 4.99 --pack-tokens 100
```

## Recommended token policy (practical guidance)

- Keep current pricing for text-first features unless quality/cost routing changes materially.
- Review animation token pricing first. Animation has the highest provider cost variance and can quickly erode margins.
- For Outfit Studio, consider output-count-aware charging if usage shifts toward 2-3 look batches.
- Re-run the profitability script whenever model routing or Google pricing changes.

## Why this is actionable

The profitability script prints:

- Current token charge per action
- Estimated revenue per action from your current pack economics
- Estimated provider-side cost per action
- Current gross margin percent
- Recommended token value to achieve your target margin
- Delta tokens needed from today

That gives you a direct pricing adjustment table you can apply to `ACTION_TOKEN_COST`.
