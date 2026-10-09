
import { urlToDataUrl } from './imageUtils';

/**
 * Social sharing helper.
 *
 * Generates a clean share card (image + brand label) on a canvas and returns a
 * data URL suitable for the Web Share API or download. Never mutates the
 * original image.
 */

export interface ShareCardOptions {
  label?: string;
  brand?: string;
}

export const generateShareCard = async (
  imageSrc: string,
  options: ShareCardOptions = {}
): Promise<string> => {
  const label = options.label || 'ChromaSnap';
  const brand = options.brand || 'chromasnap.app';

  const dataUrl = await urlToDataUrl(imageSrc);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not load image for share card.'));
    el.src = dataUrl;
  });

  const width = 1080;
  const padding = 48;
  const footerHeight = 140;
  const height = Math.round(img.height * (width / img.width)) + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  const drawHeight = height - footerHeight;
  ctx.drawImage(img, 0, 0, width, drawHeight);

  // Footer
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, drawHeight, width, footerHeight);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px Inter, sans-serif';
  ctx.fillText(label, padding, drawHeight + 64);
  ctx.fillStyle = '#818cf8';
  ctx.font = '28px Inter, sans-serif';
  ctx.fillText(brand, padding, drawHeight + 112);

  return canvas.toDataURL('image/png');
};
