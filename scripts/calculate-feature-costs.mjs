import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const serverIndexPath = path.resolve(repoRoot, 'server', 'src', 'index.ts');

const DEFAULT_GOOGLE_PLAY_PRODUCTS = {
  subscriptions: [
    { tier: 'pro', productId: 'chromasnap_pro' },
    { tier: 'enterprise', productId: 'chromasnap_enterprise' },
  ],
  topUps: [
    { tokens: 100, productId: 'chromasnap_topup_100' },
    { tokens: 500, productId: 'chromasnap_topup_500' },
    { tokens: 1000, productId: 'chromasnap_topup_1000' },
  ],
};

const BILLABLE_UI_ACTIONS = [
  { workspace: 'Colorizer', label: 'Colorize', action: 'colorize', endpoint: '/api/process/colorize', notes: 'Primary colorization request.' },
  { workspace: 'Colorizer', label: '4K Upscale', action: 'upscale', endpoint: '/api/process/upscale', notes: 'Optional enhancement after colorization.' },
  { workspace: 'Colorizer', label: 'Vibrant', action: 'vibrancy', endpoint: '/api/process/vibrancy', notes: 'Optional saturation enhancement.' },
  { workspace: 'Colorizer', label: 'Sharpen', action: 'sharpen', endpoint: '/api/process/sharpen', notes: 'Optional detail enhancement.' },
  { workspace: 'Animate', label: 'Animate', action: 'animate_start', endpoint: '/api/process/animate/start', notes: 'Charged when starting the animation job.' },
  { workspace: 'Colorizer', label: 'Animate This Photo', action: 'animate_start', endpoint: '/api/process/animate/start', notes: 'Same charge as Animate, launched from a colorized result.' },
  { workspace: 'Beauty Lab', label: 'Get Ideas', action: 'occasion_recommend', endpoint: '/api/recommend/occasion-look', notes: 'Occasion-specific look recommendations.' },
  { workspace: 'Beauty Lab', label: 'Consult Notes', action: 'beauty_consult', endpoint: '/api/consult/beauty-advisor', notes: 'Salon-style written consultation based on your notes.' },
  { workspace: 'Beauty Lab', label: 'Generate', action: 'virtual_makeup', endpoint: '/api/generate/virtual-makeup', notes: 'Creates the edited Beauty Lab after-image.' },
  { workspace: 'Beauty Lab', label: 'Generate 360 Preview', action: 'virtual_makeup', endpoint: '/api/generate/virtual-makeup', notes: 'One non-image preview call used to describe the 360 hairstyle treatment.' },
  { workspace: 'Beauty Lab', label: 'Analyze Profile', action: 'beauty_profile_analysis', endpoint: '/api/analyze/beauty-profile', notes: 'Beauty profile snapshot analysis.' },
  { workspace: 'Beauty Lab', label: 'Complexion Report', action: 'complexion_report', endpoint: '/api/analyze/complexion-report', notes: 'Complexion scan and recommended adjustments.' },
  { workspace: 'Barbershop', label: 'Get Ideas', action: 'occasion_recommend', endpoint: '/api/recommend/occasion-look', notes: 'Barbershop recommendation set.' },
  { workspace: 'Barbershop', label: 'Generate Look', action: 'virtual_makeup', endpoint: '/api/generate/virtual-makeup', notes: 'Creates the barbershop after-image.' },
  { workspace: 'Barbershop', label: 'Left / Right / Back angle buttons', action: 'virtual_makeup', endpoint: '/api/generate/virtual-makeup', notes: 'Each new non-front angle is generated on demand once per preview session and then cached.' },
  { workspace: 'Outfit Studio', label: 'Generate Outfit', action: 'outfit_tryon', endpoint: '/api/generate/outfit-tryon', notes: 'One request charge even when requesting 2 or 3 looks in the same batch.' },
];

const FEATURE_BUNDLES = [
  { feature: 'Colorize image', actions: ['colorize'] },
  { feature: 'Animate image', actions: ['animate_start'] },
  { feature: 'Barbershop full flow', actions: ['occasion_recommend', 'virtual_makeup'] },
  { feature: 'Beauty Lab core flow', actions: ['occasion_recommend', 'beauty_consult', 'virtual_makeup'] },
  { feature: 'Outfit Studio generation', actions: ['outfit_tryon'] },
];

const ZERO_COST_UI_ACTIONS = [
  { workspace: 'Colorizer / Animate', label: 'Upload, Camera, Download HD, Share, Reset, Undo', notes: 'No backend billing action.' },
  { workspace: 'Beauty Lab', label: 'Upload, Camera, Download Photo, Download Card, Reset, Apply to Beauty Lab', notes: 'No backend billing action.' },
  { workspace: 'Barbershop', label: 'Upload, Camera, Download, Reset', notes: 'No backend billing action.' },
  { workspace: 'Outfit Studio', label: 'Upload, Camera, Upload Garment, Download, Reset', notes: 'No backend billing action until Generate Outfit is pressed.' },
];

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

const parseNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

const extractPlanConfig = () => {
  const source = fs.readFileSync(serverIndexPath, 'utf8');
  const match = source.match(/const PLAN_CONFIG: Record<SubscriptionTier, PlanConfig> = \{([\s\S]*?)\n\};/);
  if (!match) {
    throw new Error(`Could not locate PLAN_CONFIG in ${serverIndexPath}`);
  }

  const planBlock = match[1];
  const planRegex = /(free|pro|enterprise):\s*\{([\s\S]*?)\n\s*\},/g;
  const plans = [];
  let planMatch;

  while ((planMatch = planRegex.exec(planBlock)) !== null) {
    const tier = planMatch[1];
    const body = planMatch[2];
    const name = body.match(/name:\s*'([^']+)'/)?.[1] || tier;
    const monthlyTokens = Number(body.match(/monthlyTokens:\s*([0-9]+)/)?.[1] || 0);
    const maxTopUpPerMonth = Number(body.match(/maxTopUpPerMonth:\s*([0-9]+)/)?.[1] || 0);
    plans.push({ id: tier, name, monthlyTokens, maxTopUpPerMonth });
  }

  return plans;
};

const resolvePricePerToken = (args) => {
  const direct = parseNumber(args['price-per-token']);
  if (direct && direct > 0) {
    return direct;
  }

  const packPrice = parseNumber(args['pack-price']);
  const packTokens = parseNumber(args['pack-tokens']);
  if (packPrice && packPrice > 0 && packTokens && packTokens > 0) {
    return packPrice / packTokens;
  }

  return null;
};

const pad = (value, width) => String(value).padEnd(width, ' ');

const formatMoney = (amount, currency) => {
  if (!Number.isFinite(amount)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: amount < 1 ? 3 : 2,
    maximumFractionDigits: amount < 1 ? 3 : 2,
  }).format(amount);
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  const costs = extractActionTokenCosts();
  const plans = extractPlanConfig();
  const pricePerToken = resolvePricePerToken(args);
  const currency = String(args.currency || 'USD').toUpperCase();
  const asJson = args.json === 'true';

  const uiRows = BILLABLE_UI_ACTIONS.map((item) => {
    const tokens = costs[item.action];
    return {
      ...item,
      tokens,
      estimatedCost: pricePerToken ? Number((tokens * pricePerToken).toFixed(6)) : null,
    };
  });

  const bundleRows = FEATURE_BUNDLES.map((bundle) => {
    const totalTokens = bundle.actions.reduce((sum, action) => sum + (costs[action] || 0), 0);
    return {
      feature: bundle.feature,
      totalTokens,
      estimatedCost: pricePerToken ? Number((totalTokens * pricePerToken).toFixed(6)) : null,
    };
  });

  if (asJson) {
    console.log(JSON.stringify({
      source: path.relative(repoRoot, serverIndexPath),
      pricePerToken,
      currency,
      plans,
      googlePlayProducts: DEFAULT_GOOGLE_PLAY_PRODUCTS,
      actionTokenCost: costs,
      uiRows,
      bundleRows,
      zeroCostActions: ZERO_COST_UI_ACTIONS,
    }, null, 2));
    return;
  }

  console.log('ChromaSnap feature pricing');
  console.log(`Source of truth: ${path.relative(repoRoot, serverIndexPath)}`);
  if (pricePerToken) {
    console.log(`Estimated price per token: ${formatMoney(pricePerToken, currency)}`);
  } else {
    console.log('Estimated price per token: not supplied. Use --price-per-token or --pack-price with --pack-tokens.');
  }

  console.log('\nPer-button billed actions');
  console.log(`${pad('Workspace', 16)} ${pad('Button', 30)} ${pad('Tokens', 8)} ${pad('Est. cost', 12)} Endpoint`);
  console.log('-'.repeat(96));
  for (const row of uiRows) {
    console.log(`${pad(row.workspace, 16)} ${pad(row.label, 30)} ${pad(row.tokens, 8)} ${pad(pricePerToken ? formatMoney(row.estimatedCost, currency) : '-', 12)} ${row.endpoint}`);
  }

  console.log('\nFeature bundles');
  console.log(`${pad('Feature', 28)} ${pad('Tokens', 8)} ${pad('Est. cost', 12)}`);
  console.log('-'.repeat(52));
  for (const row of bundleRows) {
    console.log(`${pad(row.feature, 28)} ${pad(row.totalTokens, 8)} ${pad(pricePerToken ? formatMoney(row.estimatedCost, currency) : '-', 12)}`);
  }

  console.log('\nSubscription plans');
  console.log(`${pad('Plan', 14)} ${pad('Tokens / month', 16)} ${pad('Monthly top-up cap', 18)}`);
  console.log('-'.repeat(54));
  for (const plan of plans) {
    console.log(`${pad(plan.name, 14)} ${pad(plan.monthlyTokens, 16)} ${pad(plan.maxTopUpPerMonth, 18)}`);
  }

  console.log('\nGoogle Play product mappings (default fallbacks)');
  for (const item of DEFAULT_GOOGLE_PLAY_PRODUCTS.subscriptions) {
    console.log(`- Subscription ${item.tier}: ${item.productId}`);
  }
  for (const item of DEFAULT_GOOGLE_PLAY_PRODUCTS.topUps) {
    console.log(`- Top-up ${item.tokens} tokens: ${item.productId}`);
  }

  console.log('\nZero-cost UI actions');
  for (const item of ZERO_COST_UI_ACTIONS) {
    console.log(`- ${item.workspace}: ${item.label} (${item.notes})`);
  }

  console.log('\nPurchase flow notes');
  console.log('- Web/dev can call direct subscribe/top-up endpoints when enabled.');
  console.log('- Android production flow is Google Play purchase -> /api/billing/google-play/verify.');
  console.log('- Direct subscription and top-up mutations are blocked for Android and production-hardened flows.');

  console.log('\nExamples');
  console.log('  npm run pricing:features');
  console.log('  npm run pricing:features:json');
  console.log('  npm run pricing:features -- --pack-price 4.99 --pack-tokens 100');
  console.log('  npm run pricing:features -- --price-per-token 0.05 --currency USD');
  console.log('  node scripts/calculate-feature-costs.mjs --json');
};

main();