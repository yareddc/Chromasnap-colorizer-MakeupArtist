import React, { useEffect, useMemo, useState } from 'react';

type Angle = 'front' | 'left' | 'right' | 'back';

interface MultiAngleAfterPreviewProps {
  image: string;
  alt: string;
  className?: string;
}

const ANGLES: Array<{ id: Angle; label: string }> = [
  { id: 'front', label: 'Front' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'back', label: 'Back' },
];

const drawVariant = (source: HTMLImageElement, angle: Angle): string => {
  const width = source.naturalWidth;
  const height = source.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return source.src;
  }

  ctx.save();
  ctx.translate(width / 2, height / 2);

  if (angle === 'left') {
    ctx.rotate((-10 * Math.PI) / 180);
    ctx.scale(1.12, 1.04);
  } else if (angle === 'right') {
    ctx.rotate((10 * Math.PI) / 180);
    ctx.scale(1.12, 1.04);
  } else if (angle === 'back') {
    ctx.scale(-1.08, 1.03);
  } else {
    ctx.scale(1, 1);
  }

  ctx.drawImage(source, -width / 2, -height / 2, width, height);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.92);
};

const MultiAngleAfterPreview: React.FC<MultiAngleAfterPreviewProps> = ({ image, alt, className }) => {
  const [activeAngle, setActiveAngle] = useState<Angle>('front');
  const [variants, setVariants] = useState<Record<Angle, string>>({
    front: image,
    left: image,
    right: image,
    back: image,
  });

  useEffect(() => {
    setActiveAngle('front');
    const img = new Image();
    img.onload = () => {
      setVariants({
        front: drawVariant(img, 'front'),
        left: drawVariant(img, 'left'),
        right: drawVariant(img, 'right'),
        back: drawVariant(img, 'back'),
      });
    };
    img.onerror = () => {
      setVariants({ front: image, left: image, right: image, back: image });
    };
    img.src = image;
  }, [image]);

  const activeImage = useMemo(() => variants[activeAngle] || image, [activeAngle, image, variants]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1">
        {ANGLES.map((angle) => (
          <button
            key={angle.id}
            type="button"
            onClick={() => setActiveAngle(angle.id)}
            className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider border transition-colors ${
              activeAngle === angle.id
                ? 'bg-violet-500/20 border-violet-400/60 text-violet-100'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            {angle.label}
          </button>
        ))}
      </div>
      <img src={activeImage} alt={`${alt} (${activeAngle} view)`} className={className} />
      <p className="text-[9px] text-slate-400 text-center">Multi-angle preview is simulated from the generated after image.</p>
    </div>
  );
};

export default MultiAngleAfterPreview;
