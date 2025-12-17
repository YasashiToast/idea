import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { Point, Area } from 'react-easy-crop/types';

interface ImageEditorProps {
  imageUrl: string;
}

enum AspectRatio {
  LANDSCAPE = 16 / 9,
  CINEMATIC = 2.35 / 1,
  SQUARE = 1 / 1,
}

const RATIO_CONFIG = [
  { id: AspectRatio.LANDSCAPE, label: '16:9' },
  { id: AspectRatio.CINEMATIC, label: '2.35:1' },
  { id: AspectRatio.SQUARE, label: '1:1' },
];

interface CropState {
  crop: Point;
  zoom: number;
  croppedAreaPixels: Area | null;
}

const INITIAL_STATE: CropState = {
  crop: { x: 0, y: 0 },
  zoom: 1,
  croppedAreaPixels: null,
};

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageUrl }) => {
  // Independent state for each aspect ratio
  const [cropStates, setCropStates] = useState<Record<number, CropState>>({
    [AspectRatio.LANDSCAPE]: { ...INITIAL_STATE },
    [AspectRatio.CINEMATIC]: { ...INITIAL_STATE },
    [AspectRatio.SQUARE]: { ...INITIAL_STATE },
  });

  const [isProcessing, setIsProcessing] = useState(false);

  // Reset state when imageUrl changes
  useEffect(() => {
    setCropStates({
      [AspectRatio.LANDSCAPE]: { ...INITIAL_STATE },
      [AspectRatio.CINEMATIC]: { ...INITIAL_STATE },
      [AspectRatio.SQUARE]: { ...INITIAL_STATE },
    });
  }, [imageUrl]);

  const updateCropState = (ratio: AspectRatio, updates: Partial<CropState>) => {
    setCropStates(prev => ({
      ...prev,
      [ratio]: { ...prev[ratio], ...updates }
    }));
  };

  const generateBlob = async (pixels: Area): Promise<Blob | null> => {
    try {
      const image = await createImage(imageUrl);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      canvas.width = pixels.width;
      canvas.height = pixels.height;

      ctx.drawImage(
        image,
        pixels.x,
        pixels.y,
        pixels.width,
        pixels.height,
        0,
        0,
        pixels.width,
        pixels.height
      );

      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      });
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const handleDownload = async (ratio: AspectRatio, single = true) => {
    const state = cropStates[ratio];
    if (!state.croppedAreaPixels) return;

    if (single) setIsProcessing(true);
    
    try {
      const blob = await generateBlob(state.croppedAreaPixels);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const ratioName = ratio === AspectRatio.LANDSCAPE ? '16-9' : ratio === AspectRatio.CINEMATIC ? '2.35-1' : '1-1';
        link.download = `cover-${ratioName}-${Date.now()}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Download failed", e);
      if (single) alert("下载失败，请重试");
    } finally {
      if (single) setIsProcessing(false);
    }
  };

  const handleDownloadAll = async () => {
    setIsProcessing(true);
    try {
      const ratios = [AspectRatio.LANDSCAPE, AspectRatio.CINEMATIC, AspectRatio.SQUARE];
      for (const ratio of ratios) {
        await handleDownload(ratio, false);
        await new Promise(r => setTimeout(r, 500));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mt-8 pt-8 border-t border-slate-200 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
         <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
           <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
           多尺寸导出
         </h3>
        <button
          onClick={() => handleDownloadAll()}
          disabled={isProcessing}
          className="py-2 px-4 bg-slate-900 text-white rounded-lg text-sm font-bold shadow hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          下载全部
        </button>
      </div>

      {/* Grid of Croppers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {RATIO_CONFIG.map((config) => (
           <div key={config.id} className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group hover:border-indigo-300 transition-colors">
              
              {/* Header with Icon Buttons */}
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center h-10">
                 <span className="font-bold text-slate-700 text-sm bg-white border border-slate-200 px-2 py-0.5 rounded text-xs tracking-wide">
                    {config.label}
                 </span>
                 <button 
                   onClick={() => handleDownload(config.id)}
                   title="下载此张"
                   className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-md hover:bg-indigo-50 transition-colors"
                 >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                 </button>
              </div>

              {/* Canvas Container */}
              <div className="relative w-full h-48 bg-[#0f172a] overflow-hidden">
                 <Cropper
                    image={imageUrl}
                    crop={cropStates[config.id].crop}
                    zoom={cropStates[config.id].zoom}
                    aspect={config.id}
                    onCropChange={(c) => updateCropState(config.id, { crop: c })}
                    onZoomChange={(z) => updateCropState(config.id, { zoom: z })}
                    onCropComplete={(_, pixels) => updateCropState(config.id, { croppedAreaPixels: pixels })}
                    showGrid={false}
                    objectFit="contain"
                    style={{
                       containerStyle: { background: '#0f172a' },
                    }}
                 />
              </div>

              {/* Controls */}
              <div className="px-3 py-2 bg-white flex items-center gap-3">
                 <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                 <input
                   type="range"
                   value={cropStates[config.id].zoom}
                   min={1}
                   max={3}
                   step={0.1}
                   onChange={(e) => updateCropState(config.id, { zoom: Number(e.target.value) })}
                   className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
                 />
              </div>
           </div>
        ))}
      </div>
    </div>
  );
};
