import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';

/**
 * Image storage abstraction.
 *
 * Uploads base64 image payloads to GCS and returns a signed URL. Falls back to
 * returning the original base64 data URL when GCS is not configured, so saved
 * looks keep working in local development without cloud credentials.
 */

const storageBucket = (process.env.IMAGE_STORAGE_BUCKET || '').trim();

let _storage: Storage | null = null;
const getStorage = (): Storage => {
    if (!_storage) {
        _storage = new Storage();
    }
    return _storage;
};

const stripDataUrlPrefix = (image: string): { base64: string; mimeType: string } => {
    const hasPrefix = typeof image === 'string' && image.includes(',');
    if (!hasPrefix) {
        return { base64: image, mimeType: 'image/png' };
    }
    const [head, payload] = image.split(',', 2);
    const mimeType = (head.split(';')[0].split(':')[1] || 'image/png').trim();
    return { base64: payload, mimeType };
};

export const uploadImageToStorage = async (image: string, prefix: string): Promise<string> => {
    if (!storageBucket) {
        // No GCS configured — return the image as-is (in-memory fallback).
        return image;
    }

    const { base64, mimeType } = stripDataUrlPrefix(image);
    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
    const objectName = `${prefix}/${randomUUID()}.${extension}`;

    const bucket = getStorage().bucket(storageBucket);
    const file = bucket.file(objectName);
    await file.save(Buffer.from(base64, 'base64'), {
        contentType: mimeType,
        resumable: false,
    });

    // Return a signed URL valid for 7 days (adjust as needed).
    const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return signedUrl;
};
