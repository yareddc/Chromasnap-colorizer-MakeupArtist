/**
 * Hairstyle Try-On catalog.
 *
 * Styles are intentionally data-driven (not hard-coded into components) so
 * additional styles can be added without changing UI logic. Each entry maps
 * to a stable `value` used in the generation prompt and a display `label`.
 */

export type HairCategory = 'men' | 'women' | 'unisex';
export type HairLength = 'short' | 'medium' | 'long' | 'any';

export interface HairstyleOption {
  value: string;
  label: string;
  category: HairCategory;
  length: HairLength;
}

export const HAIR_COLOR_OPTIONS = [
  { value: 'natural', label: 'Keep Natural' },
  { value: 'black', label: 'Black' },
  { value: 'dark-brown', label: 'Dark Brown' },
  { value: 'brown', label: 'Brown' },
  { value: 'light-brown', label: 'Light Brown' },
  { value: 'blonde', label: 'Blonde' },
  { value: 'platinum', label: 'Platinum' },
  { value: 'red', label: 'Red' },
  { value: 'auburn', label: 'Auburn' },
  { value: 'gray', label: 'Silver / Gray' },
  { value: 'highlighted', label: 'Highlights' },
] as const;

export type HairColorValue = (typeof HAIR_COLOR_OPTIONS)[number]['value'];

export const HAIR_LENGTH_OPTIONS = [
  { value: 'any', label: 'Any Length' },
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
] as const;

export type HairLengthValue = (typeof HAIR_LENGTH_OPTIONS)[number]['value'];

export const HAIRSTYLE_CATEGORIES: { value: HairCategory; label: string }[] = [
  { value: 'women', label: "Women's Styles" },
  { value: 'men', label: "Men's Styles" },
  { value: 'unisex', label: 'Unisex Styles' },
];

export const HAIRSTYLE_CATALOG: HairstyleOption[] = [
  // Men's styles
  { value: 'fade', label: 'Fade', category: 'men', length: 'short' },
  { value: 'low-fade', label: 'Low Fade', category: 'men', length: 'short' },
  { value: 'mid-fade', label: 'Mid Fade', category: 'men', length: 'short' },
  { value: 'high-fade', label: 'High Fade', category: 'men', length: 'short' },
  { value: 'taper', label: 'Taper', category: 'men', length: 'short' },
  { value: 'buzz-cut', label: 'Buzz Cut', category: 'men', length: 'short' },
  { value: 'crew-cut', label: 'Crew Cut', category: 'men', length: 'short' },
  { value: 'afro', label: 'Afro', category: 'men', length: 'medium' },
  { value: 'braids', label: 'Braids', category: 'men', length: 'long' },
  { value: 'cornrows', label: 'Cornrows', category: 'men', length: 'long' },
  { value: 'dreadlocks', label: 'Dreadlocks', category: 'men', length: 'long' },
  { value: 'curly', label: 'Curly', category: 'men', length: 'any' },
  { value: 'long-hair', label: 'Long Hair', category: 'men', length: 'long' },

  // Women's styles
  { value: 'bob', label: 'Bob', category: 'women', length: 'medium' },
  { value: 'pixie', label: 'Pixie', category: 'women', length: 'short' },
  { value: 'long-straight', label: 'Long Straight', category: 'women', length: 'long' },
  { value: 'long-wavy', label: 'Long Wavy', category: 'women', length: 'long' },
  { value: 'curls', label: 'Curly', category: 'women', length: 'any' },
  { value: 'box-braids', label: 'Braids', category: 'women', length: 'long' },
  { value: 'locs', label: 'Locs', category: 'women', length: 'long' },
  { value: 'ponytail', label: 'Ponytail', category: 'women', length: 'long' },
  { value: 'bangs', label: 'Bangs', category: 'women', length: 'any' },
  { value: 'updo', label: 'Updo', category: 'women', length: 'long' },

  // Unisex styles
  { value: 'shag', label: 'Shag', category: 'unisex', length: 'medium' },
  { value: 'mullet', label: 'Mullet', category: 'unisex', length: 'medium' },
  { value: 'undercut', label: 'Undercut', category: 'unisex', length: 'any' },
];

export const getHairstylesByCategory = (category: HairCategory): HairstyleOption[] =>
  HAIRSTYLE_CATALOG.filter((style) => style.category === category);

export const getHairstylesByLength = (length: HairLengthValue): HairstyleOption[] =>
  length === 'any'
    ? HAIRSTYLE_CATALOG
    : HAIRSTYLE_CATALOG.filter((style) => style.length === length);

export const getHairstyleLabel = (value: string): string => {
  const match = HAIRSTYLE_CATALOG.find((style) => style.value === value);
  return match ? match.label : value;
};

export const getHairColorLabel = (value: string): string => {
  const match = HAIR_COLOR_OPTIONS.find((color) => color.value === value);
  return match ? match.label : value;
};
