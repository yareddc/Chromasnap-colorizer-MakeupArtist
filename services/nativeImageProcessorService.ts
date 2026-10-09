/**
 * Native Image Processing Service
 * 
 * This service abstracts the image processing layer to use:
 * 1. Native Capacitor plugin (iOS/Android) for better performance
 * 2. Express backend fallback (web/dev)
 */

import { ChromaSnapImageProcessor } from '../capacitor-plugin/src/index';
import type {
  AnalyzeOptions,
  EnhancementOptions,
  AnimationOptions,
} from '../capacitor-plugin/src/index';

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY || '';

/**
 * Check image safety (nudity, minors, explicit content)
 */
export const checkImageSafety = async (
  base64Image: string
): Promise<{ isSafe: boolean; containsMinors?: boolean; reason?: string }> => {
  try {
    const result = await ChromaSnapImageProcessor.checkSafety({
      image: base64Image,
      apiKey: API_KEY,
    });
    return result;
  } catch (error) {
    console.error('Safety check failed:', error);
    return { isSafe: true, containsMinors: false, reason: '' }; // Fail-open
  }
};

/**
 * Upscale image to higher resolution
 */
export const upscaleImage = async (base64Image: string): Promise<string> => {
  try {
    const result = await ChromaSnapImageProcessor.upscaleImage({
      image: base64Image,
      apiKey: API_KEY,
    });

    if (!result.success) {
      throw new Error(result.error || 'Upscaling failed');
    }

    return result.result!;
  } catch (error: any) {
    console.error('Upscale failed:', error);
    throw new Error(error.message || 'Failed to upscale image.');
  }
};

/**
 * Enhance color vibrancy
 */
export const enhanceVibrancy = async (base64Image: string): Promise<string> => {
  try {
    const result = await ChromaSnapImageProcessor.enhanceVibrancy({
      image: base64Image,
      apiKey: API_KEY,
    });

    if (!result.success) {
      throw new Error(result.error || 'Enhancement failed');
    }

    return result.result!;
  } catch (error: any) {
    console.error('Vibrancy failed:', error);
    throw new Error(error.message || 'Failed to increase vibrancy.');
  }
};

/**
 * Sharpen image details
 */
export const sharpenImage = async (base64Image: string): Promise<string> => {
  try {
    const result = await ChromaSnapImageProcessor.sharpenImage({
      image: base64Image,
      apiKey: API_KEY,
    });

    if (!result.success) {
      throw new Error(result.error || 'Sharpening failed');
    }

    return result.result!;
  } catch (error: any) {
    console.error('Sharpen failed:', error);
    throw new Error(error.message || 'Failed to sharpen image.');
  }
};

/**
 * Generate animation from image
 */
export const animateImage = async (base64Image: string): Promise<string> => {
  try {
    const result = await ChromaSnapImageProcessor.animateImage({
      image: base64Image,
      apiKey: API_KEY,
    });

    if (!result.success) {
      throw new Error(result.error || 'Animation failed');
    }

    // For native implementations, result might be a URL
    // For API-based, it's a blob URL
    return result.result!;
  } catch (error: any) {
    console.error('Animation failed:', error);
    throw new Error(error.message || 'Failed to animate image.');
  }
};

/**
 * Listen to processing progress (native plugin feature)
 */
export const onProcessingProgress = (
  callback: (data: { progress: number; status: string }) => void
) => {
  return ChromaSnapImageProcessor.addListener('processingProgress', callback);
};
