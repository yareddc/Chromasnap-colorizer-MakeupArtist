export const BARBERSHOP_OCCASION = 'barbershop' as const;

export const OCCASION_OPTIONS = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'celebration', label: 'Celebration' },
  { value: 'party', label: 'Party/Night Out' },
  { value: 'business', label: 'Business Event' },
  { value: 'casual', label: 'Casual Everyday' },
  { value: 'photoshoot', label: 'Photoshoot' },
  { value: 'festival', label: 'Festival/Concert' },
] as const;

export const BARBERSHOP_FEATURE_OPTION = {
  value: BARBERSHOP_OCCASION,
  label: 'Barbershop Visit',
} as const;

export const GENERAL_HAIRSTYLE_OPTIONS = [
  { value: 'wavy', label: 'Loose Waves' },
  { value: 'sleek', label: 'Sleek/Straight' },
  { value: 'curly', label: 'Curls/Coils' },
  { value: 'updo', label: 'Updo/Bun' },
  { value: 'half-up', label: 'Half-Up Half-Down' },
  { value: 'braided', label: 'Braided' },
  { value: 'volume', label: 'High-Volume' },
] as const;

export const BARBERSHOP_HAIRCUT_OPTIONS = [
  { value: 'taper-fade', label: 'Taper Fade' },
  { value: 'skin-fade', label: 'Skin Fade' },
  { value: 'buzz-cut', label: 'Buzz Cut' },
  { value: 'crew-cut', label: 'Crew Cut' },
  { value: 'textured-crop', label: 'Textured Crop' },
  { value: 'pompadour', label: 'Pompadour' },
  { value: 'quiff', label: 'Quiff' },
] as const;

export const isBarbershopVisit = (occasion: string): boolean => occasion === BARBERSHOP_OCCASION;

export const buildOccasionRequestValue = (occasion: string): string =>
  isBarbershopVisit(occasion) ? 'barbershop visit' : occasion;

export const buildOccasionSuccessMessage = (occasion: string, count: number): string => {
  if (isBarbershopVisit(occasion)) {
    return `Found ${count} barbershop-ready looks for your next visit!`;
  }
  return `Found ${count} looks perfect for ${occasion}!`;
};

export const buildVirtualMakeupOccasionContext = (occasion: string, notes: string): string => {
  const normalizedOccasion = buildOccasionRequestValue(occasion);
  const trimmedNotes = notes.trim();
  if (!trimmedNotes) return normalizedOccasion;
  return `${normalizedOccasion} | Notes: ${trimmedNotes}`;
};

export const buildHair360PreviewOccasionContext = (occasion: string): string =>
  `${buildOccasionRequestValue(occasion)} 360 hairstyle preview`;

export const buildHair360BaseDescription = (hairStyle: string, occasion: string): string => {
  const normalizedOccasion = buildOccasionRequestValue(occasion);
  return `Hair preview for ${hairStyle} on ${normalizedOccasion}.`;
};
