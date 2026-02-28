import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface ColorizeOptions {
  image: string; // base64 data URL
  theme: 'Natural' | 'Cinematic' | 'Vivid' | 'Vintage' | 'Technicolor';
  apiKey: string;
}

export interface AnalyzeOptions {
  image: string; // base64 data URL
  apiKey: string;
}

export interface EnhancementOptions {
  image: string; // base64 data URL
  apiKey: string;
}

export interface AnimationOptions {
  image: string; // base64 data URL
  apiKey: string;
}

export interface ProcessResult {
  success: boolean;
  result?: string; // base64 image or video URL
  error?: string;
}

export interface SafetyCheckResult {
  isSafe: boolean;
  containsMinors?: boolean;
  reason?: string;
}

export interface MonochromaticCheckResult {
  isMonochromatic: boolean;
}

export interface ChromaSnapImageProcessorPlugin {
  /**
   * Analyze if image is black and white
   */
  analyzeMonochromatic(options: AnalyzeOptions): Promise<MonochromaticCheckResult>;

  /**
   * Check image safety (nudity, minors, explicit content)
   */
  checkSafety(options: AnalyzeOptions): Promise<SafetyCheckResult>;

  /**
   * Colorize a black and white image with specified theme
   */
  colorizeImage(options: ColorizeOptions): Promise<ProcessResult>;

  /**
   * Upscale image to higher resolution
   */
  upscaleImage(options: EnhancementOptions): Promise<ProcessResult>;

  /**
   * Enhance color vibrancy
   */
  enhanceVibrancy(options: EnhancementOptions): Promise<ProcessResult>;

  /**
   * Sharpen image details
   */
  sharpenImage(options: EnhancementOptions): Promise<ProcessResult>;

  /**
   * Generate animation from image
   */
  animateImage(options: AnimationOptions): Promise<ProcessResult>;

  /**
   * Listen to processing progress
   */
  addListener(
    eventName: 'processingProgress',
    listenerFunc: (data: { progress: number; status: string }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
}

const ChromaSnapImageProcessor = registerPlugin<ChromaSnapImageProcessorPlugin>(
  'ChromaSnapImageProcessor',
  {
    web: () => import('./web').then(m => new m.ChromaSnapImageProcessorWeb()),
  },
);

export * from './web';
export { ChromaSnapImageProcessor };
