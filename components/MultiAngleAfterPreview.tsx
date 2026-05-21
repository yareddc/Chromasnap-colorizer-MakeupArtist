import React, { useEffect, useMemo, useState } from 'react';

type Angle = 'front' | 'left' | 'right' | 'back';

interface MultiAngleAfterPreviewProps {
  image: string;
  alt: string;
  className?: string;
  requestAngleImage?: (angle: Angle) => Promise<string | null>;
}

const ANGLES: Array<{ id: Angle; label: string }> = [
  { id: 'front', label: 'Front' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'back', label: 'Back' },
];

const MultiAngleAfterPreview: React.FC<MultiAngleAfterPreviewProps> = ({ image, alt, className, requestAngleImage }) => {
  const [activeAngle, setActiveAngle] = useState<Angle>('front');
  const [variants, setVariants] = useState<Record<Angle, string | null>>({
    front: image,
    left: null,
    right: null,
    back: null,
  });
  const [loadingByAngle, setLoadingByAngle] = useState<Record<Angle, boolean>>({
    front: false,
    left: false,
    right: false,
    back: false,
  });

  useEffect(() => {
    setActiveAngle('front');
    setVariants({ front: image, left: null, right: null, back: null });
    setLoadingByAngle({ front: false, left: false, right: false, back: false });
  }, [image, requestAngleImage]);

  const loadAngleVariant = async (angle: Angle) => {
    if (angle === 'front') {
      setActiveAngle('front');
      return;
    }

    setActiveAngle(angle);
    if (!requestAngleImage || variants[angle] || loadingByAngle[angle]) {
      return;
    }

    setLoadingByAngle((prev) => ({ ...prev, [angle]: true }));
    try {
      const generated = await requestAngleImage(angle);
      setVariants((prev) => ({ ...prev, [angle]: generated || null }));
    } finally {
      setLoadingByAngle((prev) => ({ ...prev, [angle]: false }));
    }
  };

  const activeImage = useMemo(() => variants[activeAngle] || image, [activeAngle, image, variants]);
  const isGeneratingAngle = loadingByAngle[activeAngle] && activeAngle !== 'front';

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1">
        {ANGLES.map((angle) => (
          <button
            key={angle.id}
            type="button"
            onClick={() => { void loadAngleVariant(angle.id); }}
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
      {isGeneratingAngle ? (
        <div className="h-56 sm:h-64 flex items-center justify-center text-[10px] text-slate-300 px-3 text-center border border-violet-500/30 rounded-xl bg-slate-950/60">
          Rendering {activeAngle} view from the generated look...
        </div>
      ) : (
        <img src={activeImage} alt={`${alt} (${activeAngle} view)`} className={className} />
      )}
      <p className="text-[9px] text-slate-400 text-center">Left, right, and back views are generated on demand for perspective consistency.</p>
    </div>
  );
};

export default MultiAngleAfterPreview;
