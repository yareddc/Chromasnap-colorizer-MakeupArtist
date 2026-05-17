import { Capacitor } from '@capacitor/core';

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not convert file to base64.'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed reading blob for download.'));
    reader.readAsDataURL(blob);
  });

const inferMimeType = (filename: string, fallback: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  return fallback || 'application/octet-stream';
};

const dataUrlToBlob = (dataUrl: string, filename: string): Blob => {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/i);
  if (!match) {
    throw new Error('Invalid data URL provided for download.');
  }

  const mimeType = match[1] || inferMimeType(filename, 'application/octet-stream');
  const payload = match[2] || '';
  const isBase64 = /;base64,/i.test(dataUrl.slice(0, dataUrl.indexOf(',') + 1));

  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  const text = decodeURIComponent(payload.replace(/\+/g, '%20'));
  return new Blob([text], { type: mimeType });
};

const fetchAsBlob = async (sourceUrl: string, filename: string): Promise<Blob> => {
  if (/^data:/i.test(sourceUrl)) {
    return dataUrlToBlob(sourceUrl, filename);
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }
  const blob = await response.blob();
  if (!blob.type) {
    return new Blob([blob], { type: inferMimeType(filename, 'application/octet-stream') });
  }
  return blob;
};

const downloadForWeb = async (sourceUrl: string, filename: string) => {
  let objectUrl: string | null = null;
  try {
    try {
      const blob = await fetchAsBlob(sourceUrl, filename);
      objectUrl = URL.createObjectURL(blob);
    } catch {
      objectUrl = null;
    }

    const link = document.createElement('a');
    link.href = objectUrl || sourceUrl;
    link.download = filename;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();

    if (!objectUrl && /^https?:/i.test(sourceUrl)) {
      window.open(sourceUrl, '_blank', 'noopener,noreferrer');
    }
  } finally {
    if (objectUrl) {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl as string), 1000);
    }
  }
};

const downloadForNative = async (sourceUrl: string, filename: string) => {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);

  const blob = await fetchAsBlob(sourceUrl, filename);
  const base64Data = await blobToBase64(blob);

  const writeResult = await Filesystem.writeFile({
    path: `downloads/${filename}`,
    data: base64Data,
    directory: Directory.Cache,
    recursive: true,
  });

  await Share.share({
    title: 'ChromaSnap Download',
    text: filename,
    url: writeResult.uri,
    dialogTitle: 'Save or share file',
  });
};

export const downloadAsset = async (sourceUrl: string, filename: string) => {
  if (Capacitor.isNativePlatform()) {
    await downloadForNative(sourceUrl, filename);
    return;
  }

  await downloadForWeb(sourceUrl, filename);
};
