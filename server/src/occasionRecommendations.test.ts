import assert from 'node:assert/strict';
import { buildFallbackOccasionRecommendations, parseOccasionRecommendations } from './occasionRecommendations';

const structured = parseOccasionRecommendations([
    '```json',
    '{',
    '  "recommendations": [',
    '    {',
    '      "style": "Sharp Taper",',
    '      "makeup": "Oil-control base",',
    '      "hair": "Low taper fade",',
    '      "description": "Clean and interview-ready"',
    '    },',
    '    {',
    '      "name": "Weekend Texture",',
    '      "makeupDescription": "Barely-there grooming",',
    '      "hairstyle": "Textured crop",',
    '      "why": "Relaxed but polished"',
    '    }',
    '  ]',
    '}',
    '```',
].join('\n'));

assert.equal(structured.length, 2);
assert.equal(structured[0].style, 'Sharp Taper');
assert.equal(structured[1].style, 'Weekend Texture');
assert.equal(structured[1].hair, 'Textured crop');

const heuristic = parseOccasionRecommendations([
    'Look: Evening Edge',
    'Makeup: Soft matte complexion',
    'Hair: Skin fade with texture',
    'Why: Strong contrast for night events',
    '',
    'Look: Daily Clean',
    'Makeup: Lightweight correction',
    'Hair: Crew cut refresh',
    'Description: Low-maintenance polish',
].join('\n'));

assert.equal(heuristic.length, 2);
assert.equal(heuristic[0].description, 'Strong contrast for night events');
assert.equal(heuristic[1].style, 'Daily Clean');

const fallback = buildFallbackOccasionRecommendations('barbershop visit');
assert.equal(fallback.length, 3);
assert.match(fallback[0].description, /barbershop visit/i);
assert.ok(fallback.every((item) => item.style && item.makeup && item.hair && item.description));

console.log('occasion recommendation tests passed');