import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const serverIndexPath = path.resolve(repoRoot, 'server', 'src', 'index.ts');

const DEFAULT_ACTION_PROVIDER_COST_USD = {
  colorize: 0.04,
  upscale: 0.005,
  vibrancy: 0.002,
  sharpen: 0.002,
  animate_start: 0.8,
  beauty_consult: 0.006,
  virtual_makeup: 0.039,
  outfit_tryon: 0.039,
  occasion_recommend: 0.006,
  beauty_profile_analysis: 0.01,
  complexion_report: 0.008,
};

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = next;
    index += 1;
  }
  return args;
};

const parseNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolvePricePerToken = (args) => {
  const direct = parseNumber(args['price-per-token']);
  if (direct && direct > 0) return direct;

  const packPrice = parseNumber(args['pack-price']);
  const packTokens = parseNumber(args['pack-tokens']);
  if (packPrice && packPrice > 0 && packTokens && packTokens > 0) {
    return packPrice / packTokens;
  }

  return null;
};

const extractActionTokenCosts = () => {
  const source = fs.readFileSync(serverIndexPath, 'utf8');
  const match = source.match(/const ACTION_TOKEN_COST: Record<string, number> = \{([\s\S]*?)\n\};/);
  if (!match) {
    throw new Error(`Could not locate ACTION_TOKEN_COST in ${serverIndexPath}`);
  }

  const costs = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const entry = line.match(/^([a-zA-Z0-9_]+):\s*([0-9]+),?$/);
    if (!entry) continue;
    costs[entry[1]] = Number(entry[2]);
  }

  return costs;
};

const formatMoney = (amount, currency) => {
  if (!Number.isFinite(amount)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: amount < 1 ? 3 : 2,
    maximumFractionDigits: amount < 1 ? 3 : 2,
  }).format(amount);
};

const pad = (value, width) => String(value).padEnd(width, ' ');

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const actionTokenCost = extractActionTokenCosts();
  const currency = String(args.currency || 'USD').toUpperCase();
  const pricePerToken = resolvePricePerToken(args);
  const targetMargin = parseNumber(args['target-margin'], 0.7);
  const asJson = args.json === 'true';

  if (!pricePerToken || pricePerToken <= 0) {
    throw new Error('Price per token is required. Use --price-per-token or --pack-price with --pack-tokens.');
  }

  if (!(targetMargin > 0 && targetMargin < 1)) {
    throw new Error('target-margin must be between 0 and 1 (example: 0.7 for 70%).');
  }

  const rows = Object.entries(actionTokenCost)
    .map(([action, tokens]) => {
      const providerCostUsd = Number(DEFAULT_ACTION_PROVIDER_COST_USD[action] || 0);
      const revenueUsd = tokens * pricePerToken;
      const grossMarginPct = revenueUsd > 0
        ? Number((((revenueUsd - providerCostUsd) / revenueUsd) * 100).toFixed(2))
        : null;

      const targetRevenue = providerCostUsd / (1 - targetMargin);
      const recommendedTokens = Math.max(1, Math.ceil(targetRevenue / pricePerToken));
      const deltaTokens = recommendedTokens - tokens;

      return {
        action,
        currentTokens: tokens,
        providerCostUsd: Number(providerCostUsd.toFixed(6)),
        revenueUsd: Number(revenueUsd.toFixed(6)),
        grossMarginPct,
        recommendedTokens,
        deltaTokens,
      };
    })
    .sort((left, right) => left.providerCostUsd - right.providerCostUsd);

  const profitableNow = rows.filter((row) => (row.grossMarginPct ?? -999) >= 0).length;

  if (asJson) {
    console.log(JSON.stringify({
      source: path.relative(repoRoot, serverIndexPath),
      assumptions: {
        pricePerToken,
        targetMargin,
        actionProviderCostUsd: DEFAULT_ACTION_PROVIDER_COST_USD,
      },
      summary: {
        totalActions: rows.length,
        profitableNow,
      },
      rows,
    }, null, 2));
    return;
  }

  console.log('ChromaSnap profitability analysis');
  console.log(`Source of truth: ${path.relative(repoRoot, serverIndexPath)}`);
  console.log(`Effective price per token: ${formatMoney(pricePerToken, currency)}`);
  console.log(`Target gross margin: ${(targetMargin * 100).toFixed(1)}%`);

  console.log('\nPer-action profitability');
  console.log(`${pad('Action', 26)} ${pad('Tokens', 7)} ${pad('Revenue', 10)} ${pad('Provider', 10)} ${pad('Margin', 8)} ${pad('Rec tokens', 10)} Delta`);
  console.log('-'.repeat(90));
  for (const row of rows) {
    const marginText = row.grossMarginPct === null ? '-' : `${row.grossMarginPct.toFixed(2)}%`;
    console.log(
      `${pad(row.action, 26)} ${pad(row.currentTokens, 7)} ${pad(formatMoney(row.revenueUsd, currency), 10)} ${pad(formatMoney(row.providerCostUsd, currency), 10)} ${pad(marginText, 8)} ${pad(row.recommendedTokens, 10)} ${row.deltaTokens >= 0 ? `+${row.deltaTokens}` : row.deltaTokens}`
    );
  }

  console.log('\nCommands');
  console.log('  npm run pricing:profitability -- --pack-price 4.99 --pack-tokens 100');
  console.log('  npm run pricing:profitability -- --price-per-token 0.05 --target-margin 0.75');
  console.log('  npm run pricing:profitability:json -- --pack-price 4.99 --pack-tokens 100');
};

main();
