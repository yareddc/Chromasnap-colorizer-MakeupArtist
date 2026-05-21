
import React from 'react';
import { downloadAsset } from '../services/downloadService';

interface VideoResultProps {
  videoUrl: string;
  onDownload?: () => void | Promise<void>;
}

const VideoResult: React.FC<VideoResultProps> = ({ videoUrl, onDownload }) => {
  return (
    <div className="w-full max-w-2xl px-4 animate-in zoom-in-95 duration-700">
      <div className="relative w-full aspect-video rounded-3xl overflow-hidden shadow-2xl border border-slate-700 bg-black group">
        <video 
          src={videoUrl} 
          className="w-full h-full object-contain" 
          controls 
          autoPlay 
          loop
          playsInline
        />
        <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-indigo-500/60 backdrop-blur-md rounded-full text-xs font-bold text-white border border-white/10 uppercase tracking-wider">
          AI Animated
        </div>
      </div>
      
      <div className="w-full flex justify-between items-center px-2 mt-4">
        <p className="text-slate-400 text-sm italic">Video generated from your colorized photo</p>
        <button
          type="button"
          onClick={() => {
            if (onDownload) {
              void onDownload();
              return;
            }
            void downloadAsset(videoUrl, 'chromasnap-animation.mp4');
          }}
          className="flex items-center gap-2 text-indigo-400 font-semibold hover:text-indigo-300 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download MP4
        </button>
      </div>
    </div>
  );
};

export default VideoResult;
