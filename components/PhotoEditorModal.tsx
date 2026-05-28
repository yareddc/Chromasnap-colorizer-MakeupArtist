import React, { useEffect, useMemo, useState } from 'react';

type AspectPreset = 'headshot' | 'portrait' | 'square' | 'wide';

interface PhotoEditorModalProps {
  image: string;
  title?: string;
  onCancel: () => void;
  onApply: (editedImage: string) => void;
}

const ASPECT_PRESETS: Record<AspectPreset, { label: string; ratio: number }> = {
  headshot: { label: 'Headshot 3:4', ratio: 3 / 4 },
  portrait: { label: 'Portrait 4:5', ratio: 4 / 5 },
  square: { label: 'Square 1:1', ratio: 1 },
  wide: { label: 'Wide 16:9', ratio: 16 / 9 },
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeRotation = (degrees: number) => {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const buildCropRect = (
  imageWidth: number,
  imageHeight: number,
  aspectRatio: number,
  zoom: number,
  focusX: number,
  focusY: number
) => {
  const imageRatio = imageWidth / imageHeight;

  let baseCropWidth = imageWidth;
  let baseCropHeight = imageHeight;
  if (imageRatio > aspectRatio) {
    baseCropWidth = imageHeight * aspectRatio;
  } else {
    baseCropHeight = imageWidth / aspectRatio;
  }

  const cropWidth = baseCropWidth / zoom;
  const cropHeight = baseCropHeight / zoom;

  const maxX = Math.max(0, imageWidth - cropWidth);
  const maxY = Math.max(0, imageHeight - cropHeight);

  const centeredX = maxX / 2;
  const centeredY = maxY / 2;

  const x = clamp(centeredX + (focusX / 100) * (maxX / 2), 0, maxX);
  const y = clamp(centeredY + (focusY / 100) * (maxY / 2), 0, maxY);

  return { x, y, width: cropWidth, height: cropHeight };
};

const renderCroppedImage = (
  sourceImage: HTMLImageElement,
  aspectRatio: number,
  zoom: number,
  focusX: number,
  focusY: number,
  rotationDegrees: number,
  outputWidth: number
) => {
  const rotation = normalizeRotation(rotationDegrees);
  const rotationRadians = (rotation * Math.PI) / 180;

  let processingSource: CanvasImageSource = sourceImage;
  let processingWidth = sourceImage.naturalWidth;
  let processingHeight = sourceImage.naturalHeight;

  if (rotation !== 0) {
    const sin = Math.abs(Math.sin(rotationRadians));
    const cos = Math.abs(Math.cos(rotationRadians));
    const rotatedWidth = Math.ceil(sourceImage.naturalWidth * cos + sourceImage.naturalHeight * sin);
    const rotatedHeight = Math.ceil(sourceImage.naturalWidth * sin + sourceImage.naturalHeight * cos);

    const rotatedCanvas = document.createElement('canvas');
    rotatedCanvas.width = rotatedWidth;
    rotatedCanvas.height = rotatedHeight;

    const rotatedContext = rotatedCanvas.getContext('2d');
    if (!rotatedContext) {
      throw new Error('Could not create rotated image canvas context.');
    }

    rotatedContext.translate(rotatedWidth / 2, rotatedHeight / 2);
    rotatedContext.rotate(rotationRadians);
    rotatedContext.drawImage(
      sourceImage,
      -sourceImage.naturalWidth / 2,
      -sourceImage.naturalHeight / 2,
      sourceImage.naturalWidth,
      sourceImage.naturalHeight
    );

    processingSource = rotatedCanvas;
    processingWidth = rotatedWidth;
    processingHeight = rotatedHeight;
  }

  const crop = buildCropRect(processingWidth, processingHeight, aspectRatio, zoom, focusX, focusY);
  const outputHeight = Math.round(outputWidth / aspectRatio);

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not create image editor canvas context.');
  }

  context.drawImage(
    processingSource,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return canvas.toDataURL('image/jpeg', 0.92);
};

const PhotoEditorModal: React.FC<PhotoEditorModalProps> = ({ image, title, onCancel, onApply }) => {
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [aspectPreset, setAspectPreset] = useState<AspectPreset>('headshot');
  const [zoom, setZoom] = useState(1.2);
  const [focusX, setFocusX] = useState(0);
  const [focusY, setFocusY] = useState(-20);
  const [rotation, setRotation] = useState(0);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setSourceImage(img);
    img.src = image;
  }, [image]);

  const aspectRatio = ASPECT_PRESETS[aspectPreset].ratio;

  const previewImage = useMemo(() => {
    if (!sourceImage) return image;
    try {
      return renderCroppedImage(sourceImage, aspectRatio, zoom, focusX, focusY, rotation, 860);
    } catch {
      return image;
    }
  }, [aspectRatio, focusX, focusY, image, rotation, sourceImage, zoom]);

  const handleApply = async () => {
    if (!sourceImage) {
      onApply(image);
      return;
    }

    setIsApplying(true);
    try {
      const edited = renderCroppedImage(sourceImage, aspectRatio, zoom, focusX, focusY, rotation, 1440);
      onApply(edited);
    } finally {
      setIsApplying(false);
    }
  };

  const resetForHeadFocus = () => {
    setAspectPreset('headshot');
    setZoom(1.25);
    setFocusX(0);
    setFocusY(-30);
    setRotation(0);
  };

  const rotateBy = (degrees: number) => {
    setRotation((current) => normalizeRotation(current + degrees));
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-2rem)] rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl p-3 sm:p-5 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-[0.16em]">
              {title || 'Edit Photo Before Processing'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Crop, rotate, and shift focus above the neck before running AI processing.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="w-9 h-9 rounded-full border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
            aria-label="Close photo editor"
          >
            x
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.35fr_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-3">
            <div className="w-full rounded-xl overflow-hidden border border-slate-800">
              <img
                src={previewImage}
                alt="Edited preview"
                className="w-full max-h-[36vh] sm:max-h-[48vh] object-contain bg-slate-950"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-3 sm:p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Crop Preset</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(ASPECT_PRESETS) as AspectPreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAspectPreset(preset)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      aspectPreset === preset
                        ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {ASPECT_PRESETS[preset].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Rotate</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => rotateBy(-90)}
                  className="px-3 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-200 hover:border-slate-500 transition-colors"
                >
                  Rotate Left
                </button>
                <button
                  type="button"
                  onClick={() => rotateBy(90)}
                  className="px-3 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-200 hover:border-slate-500 transition-colors"
                >
                  Rotate Right
                </button>
              </div>
              <input
                type="range"
                min={0}
                max={359}
                step={1}
                value={rotation}
                onChange={(event) => setRotation(Number(event.target.value))}
                className="w-full"
              />
              <div className="text-[10px] text-slate-400">{rotation.toFixed(0)}deg (360deg control)</div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-full"
              />
              <div className="text-[10px] text-slate-400">{zoom.toFixed(2)}x</div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Horizontal Focus</label>
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={focusX}
                onChange={(event) => setFocusX(Number(event.target.value))}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vertical Focus (move up)</label>
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={focusY}
                onChange={(event) => setFocusY(Number(event.target.value))}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={resetForHeadFocus}
                className="px-3 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-200 hover:border-slate-500 transition-colors"
              >
                Head Focus Preset
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1.2);
                  setFocusX(0);
                  setFocusY(-20);
                }}
                className="px-3 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-200 hover:border-slate-500 transition-colors"
              >
                Reset
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-3 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isApplying}
                onClick={() => {
                  void handleApply();
                }}
                className="px-4 py-3 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-60"
              >
                {isApplying ? 'Applying...' : 'Apply Photo'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoEditorModal;
