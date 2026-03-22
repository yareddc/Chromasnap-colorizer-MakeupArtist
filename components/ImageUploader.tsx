
import React, { useRef, useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

interface ImageUploaderProps {
  onImageSelected: (base64: string) => void;
  isLoading: boolean;
  onSampleSelect?: () => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, isLoading, onSampleSelect }) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = () => {
    if (isLoading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      onImageSelected(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  const handleTakePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera, // Force camera source
      });

      if (image.dataUrl) {
        onImageSelected(image.dataUrl);
      }
    } catch (error) {
      console.error('Camera cancelled or failed:', error);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const isNative = Capacitor.isNativePlatform();

  return (
    <div className="w-full max-w-md mx-auto space-y-4 px-1 sm:px-0">
      <div
        className={`
          relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-3xl overflow-hidden
          transition-all duration-300
          ${isLoading
            ? 'border-indigo-500/30 bg-slate-800/20 opacity-50 cursor-not-allowed'
            : dragActive
              ? 'border-indigo-500 bg-indigo-500/10 scale-102'
              : 'border-slate-700 hover:border-indigo-500/50 bg-slate-800/30 hover:bg-slate-800/50'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        role="button"
        tabIndex={isLoading ? -1 : 0}
        onClick={openFilePicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openFilePicker();
          }
        }}
        aria-label="Upload an image"
      >
        <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer z-10">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className={`w-12 h-12 mb-4 transition-colors ${dragActive ? 'text-indigo-400' : 'text-slate-400'}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
            </svg>
            <p className="mb-2 text-sm text-slate-300 font-medium">Drop a photo or click to upload</p>
            <p className="text-xs text-slate-400">JPG, PNG, WEBP • up to 20MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isLoading}
          />
        </label>

        {/* Helper overlay for drag */}
        {dragActive && (
          <div className="absolute inset-0 bg-indigo-500/10 z-0 pointer-events-none" />
        )}
      </div>

      {/* Camera Button (Visible on Mobile/Native or if desired on web too) */}
      <div className="flex justify-center">
        <button
          onClick={handleTakePhoto}
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-3 min-h-[48px] bg-slate-800 hover:bg-slate-700 text-indigo-400 font-semibold rounded-full border border-slate-700 transition-all active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Take Photo
        </button>
      </div>

      <div className="flex items-center justify-center">
        <button
          onClick={openFilePicker}
          disabled={isLoading}
          className="px-4 py-3 min-h-[44px] text-xs font-semibold rounded-full border border-slate-700 text-slate-300 hover:border-indigo-400 hover:text-white transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Choose file
        </button>
      </div>

      <div className="flex items-center justify-center">
        <button
          onClick={onSampleSelect}
          disabled={isLoading || !onSampleSelect}
          className="px-4 py-3 min-h-[44px] text-xs font-semibold rounded-full border border-slate-700 text-slate-300 hover:border-indigo-400 hover:text-white transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Try sample image
        </button>
      </div>

    </div>
  );
};

export default ImageUploader;
