import { generateVirtualMakeup, recommendOccasionLook } from './geminiService';
import {
  BARBERSHOP_OCCASION,
  buildOccasionRequestValue,
  buildOccasionSuccessMessage,
  buildVirtualMakeupOccasionContext,
} from './barbershopVisitFeature';

export type BarbershopStyleIntensity = 'subtle' | 'balanced' | 'dramatic';

export interface BarbershopLookRecommendation {
  style: string;
  makeup: string;
  hair: string;
  description: string;
}

export interface GenerateBarbershopLookInput {
  selfieBase64: string;
  makeupStyle: string;
  haircut: string;
  notes: string;
  styleIntensity: BarbershopStyleIntensity;
}

const humanizeHaircutLabel = (value: string): string =>
  value
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export const getBarbershopRecommendations = async (
  selfieBase64: string
): Promise<{ recommendations: BarbershopLookRecommendation[]; message: string; fallback?: boolean }> => {
  const result = await recommendOccasionLook(
    selfieBase64,
    buildOccasionRequestValue(BARBERSHOP_OCCASION)
  );

  return {
    recommendations: result.recommendations,
    message:
      typeof result.message === 'string' && result.message.trim()
        ? result.message
        : buildOccasionSuccessMessage(BARBERSHOP_OCCASION, result.recommendations.length),
    fallback: result.fallback,
  };
};

export const generateBarbershopLook = async (
  input: GenerateBarbershopLookInput
): Promise<{ recommendations: BarbershopLookRecommendation[]; afterImage: string; message: string }> => {
  const result = await generateVirtualMakeup(
    input.selfieBase64,
    input.makeupStyle,
    input.haircut,
    buildVirtualMakeupOccasionContext(BARBERSHOP_OCCASION, input.notes),
    { styleIntensity: input.styleIntensity }
  );

  const recommendations: BarbershopLookRecommendation[] = [
    {
      style: `Barbershop ${humanizeHaircutLabel(input.haircut)}`,
      makeup: result.description.substring(0, 200),
      hair: input.haircut,
      description: result.description,
    },
  ];

  return {
    recommendations,
    afterImage: result.editedImage || input.selfieBase64,
    message: 'Barbershop look generated! Review the preview below.',
  };
};
