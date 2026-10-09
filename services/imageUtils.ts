/**
 * Reusable image handling: validation + read-as-data-URL.
 * Keeps upload logic consistent across features.
 */

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export const validateImageFile = (file: File): ImageValidationResult => {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Unsupported file type. Use JPG, PNG, or WEBP.' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'Image is too large (max 20MB).' };
  }
  return { valid: true };
};

export const readImageFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read image file.'));
    };
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });

export const urlToDataUrl = async (src: string): Promise<string> => {
  if (/^data:/i.test(src)) return src;
  const res = await fetch(src, { credentials: 'include' });
  const blob = await res.blob();
  return readImageFileAsDataUrl(new File([blob], 'image', { type: blob.type || 'image/jpeg' }));
};
